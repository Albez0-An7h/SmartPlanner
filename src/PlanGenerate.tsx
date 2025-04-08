import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calendarEvents } from './CalanderData';
import { updateCalendarWithSchedule } from './UpdateCalander';
import { Task, GeneratedSchedule } from './types';

const PlanGenerate: React.FC = () => {
    // State for user inputs
    const [wakeupTime, setWakeupTime] = useState('07:00');
    const [sleepTime, setSleepTime] = useState('22:00');
    const [newTask, setNewTask] = useState<Task>({
        id: '',
        title: '',
        description: '',
        priority: 'Medium',
        timeFrame: 'Anytime',
        duration: 30
    });
    const [userTasks, setUserTasks] = useState<Task[]>([]);
    const [generatedSchedule, setGeneratedSchedule] = useState<GeneratedSchedule | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updateStatus, setUpdateStatus] = useState<{ success?: boolean; message?: string } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    
    // Fix: Use local date components to ensure correct timezone handling
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const localDate = `${year}-${month}-${day}`;
    const [selectedDate, setSelectedDate] = useState<string>(localDate);

    // Handle adding a new task
    const handleAddTask = () => {
        if (newTask.title.trim() === '') {
            setError('Task title cannot be empty');
            return;
        }

        const taskToAdd = {
            ...newTask,
            id: Date.now().toString()
        };

        setUserTasks([...userTasks, taskToAdd]);
        setNewTask({
            id: '',
            title: '',
            description: '',
            priority: 'Medium',
            timeFrame: 'Anytime', // Default timeFrame
            duration: 30
        });
        setError(null);
    };

    // Delete all tasks
    const handleDeleteAllTasks = () => {
        setUserTasks([]);
        setGeneratedSchedule(null);
        setUpdateStatus(null);
    };

    // Start editing a task
    const handleEditTask = (taskId: string) => {
        const taskToEdit = userTasks.find(task => task.id === taskId);
        if (taskToEdit) {
            setNewTask({ ...taskToEdit });
            setEditingTaskId(taskId);
        }
    };

    // Update an existing task
    const handleUpdateTask = () => {
        if (editingTaskId && newTask.title.trim() !== '') {
            setUserTasks(prevTasks => 
                prevTasks.map(task => 
                    task.id === editingTaskId ? { ...newTask, id: editingTaskId } : task
                )
            );
            setNewTask({
                id: '',
                title: '',
                description: '',
                priority: 'Medium',
                timeFrame: 'Anytime',
                duration: 30
            });
            setEditingTaskId(null);
            setError(null);
        } else {
            setError('Task title cannot be empty');
        }
    };

    // Delete a specific task
    const handleDeleteTask = (taskId: string) => {
        setUserTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
        if (editingTaskId === taskId) {
            setNewTask({
                id: '',
                title: '',
                description: '',
                priority: 'Medium',
                timeFrame: 'Anytime',
                duration: 30
            });
            setEditingTaskId(null);
        }
    };

    // Cancel editing
    const handleCancelEdit = () => {
        setNewTask({
            id: '',
            title: '',
            description: '',
            priority: 'Medium',
            timeFrame: 'Anytime',
            duration: 30
        });
        setEditingTaskId(null);
    };

    // Generate schedule using Gemini API
    const generateSchedule = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Initialize the Gemini API client
            const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

            // Use the gemini-2.0-flash-exp model
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

            // Combine calendar events with user tasks
            const allEvents = [
                ...(Array.isArray(calendarEvents) ? calendarEvents.map(event => ({
                    title: event.summary,
                    startTime: event.start.dateTime,
                    endTime: event.end.dateTime,
                    priority: 'Medium'
                })) : []),
                ...userTasks.map(task => ({
                    title: task.title,
                    description: task.description,
                    duration: task.duration,
                    priority: task.priority
                }))
            ];

            // Prepare prompt for Gemini
            const prompt = `
        Generate an optimized daily schedule based on the following parameters:
        - Wake-up time: ${wakeupTime}
        - Sleep time: ${sleepTime}
        - Existing events and tasks: ${JSON.stringify(allEvents)}
        
        Please organize tasks by priority (High, Medium, Low) and respect the preferred time frames for tasks when provided.
        Return the schedule as a valid JSON object with a 'schedule' array containing time slots and assigned tasks.
        Each item in the array should have 'time', 'task', and 'priority' fields.
        Include brief transitions between tasks and suggest the best time for high-priority tasks when energy levels are optimal.
        `;

            // Get response from Gemini
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const textResponse = response.text();

            // Extract JSON from the response
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsedSchedule = JSON.parse(jsonMatch[0]) as GeneratedSchedule;
                setGeneratedSchedule(parsedSchedule);
            } else {
                throw new Error('Failed to parse schedule from API response');
            }
        } catch (err) {
            console.error('Gemini API error:', err);
            setError(`Failed to generate schedule: ${err instanceof Error ? err.message : String(err)}`);

            // Display more helpful error message to user
            if (String(err).includes('not found for API version') || String(err).includes('models')) {
                setError('API configuration error: The AI model is temporarily unavailable. Please check your API key and try again later.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Handle date selection for the schedule
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSelectedDate(e.target.value);
    };

    // Handle calendar update
    const handleUpdateCalendar = async () => {
        if (!generatedSchedule) return;

        setIsUpdating(true);
        setUpdateStatus(null);

        // Check if user is authenticated - use sessionStorage instead of localStorage to match where the token is actually stored
        const token = sessionStorage.getItem('gapi-token');
        if (!token) {
            setUpdateStatus({
                success: false,
                message: "You need to sign in with Google first (at the top of the page)"
            });
            setIsUpdating(false);
            return;
        }

        try {
            const result = await updateCalendarWithSchedule(generatedSchedule, selectedDate);
            setUpdateStatus({
                success: result.success,
                message: result.message
            });
        } catch (err) {
            setUpdateStatus({
                success: false,
                message: `Error: ${err instanceof Error ? err.message : String(err)}`
            });
        } finally {
            setIsUpdating(false);
        }
    };

    // Add tasks directly to calendar without generating schedule
    const handleAddTasksToCalendar = async () => {
        if (userTasks.length === 0) {
            setUpdateStatus({
                success: false,
                message: "No tasks to add to calendar"
            });
            return;
        }

        setIsUpdating(true);
        setUpdateStatus(null);

        // Check if user is authenticated
        const token = sessionStorage.getItem('gapi-token');
        if (!token) {
            setUpdateStatus({
                success: false,
                message: "You need to sign in with Google first (at the top of the page)"
            });
            setIsUpdating(false);
            return;
        }

        try {
            // Format tasks as a simple schedule
            const simpleSchedule: GeneratedSchedule = {
                schedule: userTasks.map(task => ({
                    time: task.timeFrame === 'Morning' ? '09:00 AM' :
                          task.timeFrame === 'Afternoon' ? '01:00 PM' :
                          task.timeFrame === 'Evening' ? '06:00 PM' :
                          task.timeFrame === 'Night' ? '09:00 PM' : '12:00 PM',
                    task: task.title,
                    priority: task.priority
                }))
            };

            const result = await updateCalendarWithSchedule(simpleSchedule, selectedDate);
            setUpdateStatus({
                success: result.success,
                message: result.message
            });
        } catch (err) {
            setUpdateStatus({
                success: false,
                message: `Error: ${err instanceof Error ? err.message : String(err)}`
            });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto my-8">
            <h2 className="text-2xl font-bold text-[#27548A] mb-6">Generate Optimized Schedule</h2>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="text-xl font-bold text-[#48A6A7] mb-4">Set Your Day Boundaries</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="input-group">
                        <label className="block mb-2 text-gray-700">
                            Wake-up Time:
                            <input
                                type="time"
                                value={wakeupTime}
                                onChange={(e) => setWakeupTime(e.target.value)}
                                className="w-full mt-1 p-2 border rounded focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
                            />
                        </label>
                    </div>
                    <div className="input-group">
                        <label className="block mb-2 text-gray-700">
                            Sleep Time:
                            <input
                                type="time"
                                value={sleepTime}
                                onChange={(e) => setSleepTime(e.target.value)}
                                className="w-full mt-1 p-2 border rounded focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
                            />
                        </label>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="text-xl font-bold text-[#48A6A7] mb-4">
                    {editingTaskId ? 'Edit Task' : 'Add New Task'}
                </h3>
                <div className="input-group">
                    <label className="block mb-2 text-gray-700">
                        Task Title:
                        <input
                            type="text"
                            value={newTask.title}
                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                            placeholder="Enter task title"
                            className="w-full mt-1 p-2 border rounded focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
                        />
                    </label>
                </div>
                <div className="input-group">
                    <label className="block mb-2 text-gray-700">
                        Description:
                        <textarea
                            value={newTask.description}
                            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                            placeholder="Optional description"
                            className="w-full mt-1 p-2 border rounded focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
                        />
                    </label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="input-group">
                        <label className="block mb-2 text-gray-700">
                            Priority:
                            <select
                                value={newTask.priority}
                                onChange={(e) => setNewTask({
                                    ...newTask,
                                    priority: e.target.value as 'High' | 'Medium' | 'Low'
                                })}
                                className="w-full mt-1 p-2 border rounded focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
                            >
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </label>
                    </div>
                    <div className="input-group">
                        <label className="block mb-2 text-gray-700">
                            Preferred Time:
                            <select
                                value={newTask.timeFrame}
                                onChange={(e) => setNewTask({
                                    ...newTask,
                                    timeFrame: e.target.value
                                })}
                                className="w-full mt-1 p-2 border rounded focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
                            >
                                <option value="Anytime">Anytime</option>
                                <option value="Morning">Morning (6AM-12PM)</option>
                                <option value="Afternoon">Afternoon (12PM-5PM)</option>
                                <option value="Evening">Evening (5PM-9PM)</option>
                                <option value="Night">Night (9PM-12AM)</option>
                            </select>
                        </label>
                    </div>
                </div>
                <div className="input-group mt-4">
                    <label className="block mb-2 text-gray-700">
                        Duration (minutes):
                        <input
                            type="number"
                            value={newTask.duration}
                            onChange={(e) => setNewTask({ ...newTask, duration: parseInt(e.target.value) || 0 })}
                            min="5"
                            step="5"
                            className="w-full mt-1 p-2 border rounded focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
                        />
                    </label>
                </div>
                <div className="flex gap-2 mt-4">
                    {editingTaskId ? (
                        <>
                            <button 
                                onClick={handleUpdateTask} 
                                className="flex-1 bg-[#48A6A7] hover:bg-[#006A71] text-white py-3 px-6 rounded-lg transition duration-200"
                            >
                                Update Task
                            </button>
                            <button 
                                onClick={handleCancelEdit}
                                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 px-6 rounded-lg transition duration-200"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={handleAddTask} 
                            className="w-full bg-[#48A6A7] hover:bg-[#006A71] text-white py-3 px-6 rounded-lg transition duration-200"
                        >
                            Add Task
                        </button>
                    )}
                </div>
                {error && <p className="error text-red-500 mt-2">{error}</p>}
            </div>

            <div className="tasks-list mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-[#48A6A7]">Tasks to Schedule:</h3>
                    {userTasks.length > 0 && (
                        <button 
                            onClick={handleDeleteAllTasks} 
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition duration-200"
                        >
                            Delete All Tasks
                        </button>
                    )}
                </div>
                
                {userTasks.length > 0 ? (
                    <ul className="bg-gray-50 rounded-lg p-4">
                        {userTasks.map((task) => (
                            <li key={task.id} className="mb-4 pb-3 border-b last:border-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <strong className="text-[#27548A]">{task.title}</strong> 
                                        <span className="text-gray-600">
                                            ({task.priority} priority, {task.duration} min
                                            {task.timeFrame !== 'Anytime' && `, ${task.timeFrame}`})
                                        </span>
                                        {task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}
                                    </div>
                                    <div className="flex space-x-2">
                                        <button 
                                            onClick={() => handleEditTask(task.id)}
                                            className="text-blue-600 hover:text-blue-800 text-sm rounded px-2 py-1 hover:bg-blue-50"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteTask(task.id)}
                                            className="text-red-600 hover:text-red-800 text-sm rounded px-2 py-1 hover:bg-red-50"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500 bg-gray-50 p-4 rounded-lg">No tasks added yet.</p>
                )}
                
                {userTasks.length > 0 && (
                    <button
                        onClick={handleAddTasksToCalendar}
                        disabled={isUpdating}
                        className="w-full mt-4 bg-[#27548A] hover:bg-[#1D3F66] text-white py-2 px-4 rounded-lg transition duration-200 disabled:bg-gray-400"
                    >
                        {isUpdating ? 'Adding to Calendar...' : 'Add Tasks Directly to Calendar'}
                    </button>
                )}
            </div>

            <div className="existing-events mb-6">
                <h3 className="text-xl font-bold text-[#48A6A7] mb-4">Existing Calendar Events:</h3>
                {Array.isArray(calendarEvents) && calendarEvents.length > 0 ? (
                    <ul className="bg-gray-50 rounded-lg p-4">
                        {calendarEvents.map((event, index) => (
                            <li key={index} className="mb-2 pb-2 border-b last:border-0">
                                <strong className="text-[#27548A]">{event.summary}</strong>
                                {event.start?.dateTime && event.end?.dateTime && (
                                    <span className="text-sm text-gray-600">
                                        ({new Date(event.start.dateTime).toLocaleTimeString()} - {new Date(event.end.dateTime).toLocaleTimeString()})
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-500">No calendar events available.</p>
                )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="text-xl font-bold text-[#48A6A7] mb-4">Schedule Date</h3>
                <div className="input-group">
                    <label className="block mb-2 text-gray-700">
                        Date for scheduled tasks:
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={handleDateChange}
                            className="w-full mt-1 p-2 border rounded focus:ring-2 focus:ring-[#48A6A7] focus:border-transparent"
                        />
                    </label>
                </div>
            </div>

            <button
                onClick={generateSchedule}
                disabled={isLoading || userTasks.length === 0}
                className="w-full bg-[#48A6A7] hover:bg-[#006A71] text-white py-3 px-6 rounded-lg transition duration-200 disabled:bg-gray-400"
            >
                {isLoading ? 'Generating...' : 'Generate Optimized Schedule'}
            </button>
            
            {userTasks.length === 0 && (
                <p className="text-amber-600 text-center mt-2">Add some tasks to generate a schedule</p>
            )}

            {generatedSchedule && (
                <div className="schedule-result mt-6">
                    <h3 className="text-xl font-bold text-[#48A6A7] mb-4">Your Optimized Schedule</h3>

                    {!sessionStorage.getItem('gapi-token') && (
                        <div className="mb-3 p-3 bg-yellow-100 text-yellow-800 rounded">
                            <p className="font-medium">⚠️ Please sign in with Google at the top of the page to enable calendar updates.</p>
                        </div>
                    )}

                    <ul className="bg-gray-50 rounded-lg p-4">
                        {generatedSchedule.schedule.map((item, index) => (
                            <li key={index} className="mb-2 pb-2 border-b last:border-0">
                                <span className="time block text-[#27548A] font-bold">{item.time}</span>
                                <span className={`task ${item.priority === 'High' ? 'text-red-600' : item.priority === 'Medium' ? 'text-orange-500' : 'text-blue-500'}`}>
                                    {item.task}
                                </span>
                                <span className="priority text-xs px-2 py-1 ml-2 rounded"
                                    style={{
                                        backgroundColor: item.priority === 'High' ? '#FECACA' : item.priority === 'Medium' ? '#FEF3C7' : '#DBEAFE',
                                        color: item.priority === 'High' ? '#991B1B' : item.priority === 'Medium' ? '#92400E' : '#1E40AF'
                                    }}>
                                    {item.priority}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <button
                        onClick={handleUpdateCalendar}
                        disabled={isUpdating}
                        className="w-full bg-[#27548A] hover:bg-[#1D3F66] text-white py-3 px-6 rounded-lg transition duration-200 disabled:bg-gray-400"
                    >
                        {isUpdating ? 'Updating Calendar...' : 'Add This Schedule to Google Calendar'}
                    </button>

                    {updateStatus && (
                        <div className={`mt-3 p-3 rounded ${updateStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {updateStatus.message}
                        </div>
                    )}
                </div>
            )}

            {updateStatus && (
                <div className={`mt-3 p-3 rounded ${updateStatus.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {updateStatus.message}
                </div>
            )}
        </div>
    );
};

export default PlanGenerate;

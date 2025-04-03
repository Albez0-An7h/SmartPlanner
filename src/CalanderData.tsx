import React, { useEffect, useState } from 'react';

// Define types for calendar events
interface CalendarEvent {
    id: string;
    summary: string;
    start: {
        dateTime: string;
        timeZone: string;
    };
    end: {
        dateTime: string;
        timeZone: string;
    };
    description?: string;
    location?: string;
    status: string;
    attendees?: Array<{
        email: string;
        responseStatus: string;
        displayName?: string;
    }>;
}

// Add user info interface
interface UserInfo {
    name: string;
    email: string;
    picture?: string;
}

// Change the export to match how it's used
export let calendarEvents: CalendarEvent[] = [];

const CalendarData: React.FC = () => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState<Date>(new Date());
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

    // Your Google API client ID from Google Cloud Console
    const CLIENT_ID = '975583872856-ifb9hotnr7sq4e28b7toiq58148qilkn.apps.googleusercontent.com';
    const API_KEY = 'AIzaSyCejZ7xPiFDrTglqOrTp16d-VeqBLpMYR8';
    const SCOPES = 'https://www.googleapis.com/auth/calendar'; // Remove .readonly to allow write access

    // Update the export in the useEffect
    useEffect(() => {
        // Clear and update the exported events whenever the internal state changes
        calendarEvents = events;
    }, [events]);

    useEffect(() => {
        // Load Google Identity Services script
        const loadGoogleScript = () => {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = initGoogleIdentity;
            document.body.appendChild(script);
            return () => {
                document.body.removeChild(script);
            };
        };

        // Load GAPI script
        const loadGapiScript = () => {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.async = true;
            script.defer = true;
            script.onload = initGapiClient;
            document.body.appendChild(script);
            return () => {
                document.body.removeChild(script);
            };
        };

        const cleanup1 = loadGoogleScript();
        const cleanup2 = loadGapiScript();

        return () => {
            cleanup1();
            cleanup2();
        };
    }, []);

    const initGapiClient = () => {
        window.gapi.load('client', async () => {
            try {
                await window.gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
                });
                console.log('GAPI client initialized');

                // Check if we already have a token in sessionStorage
                const token = sessionStorage.getItem('gapi-token');
                if (token) {
                    window.gapi.client.setToken(JSON.parse(token));
                    setIsAuthenticated(true);
                    fetchUserInfo();
                    fetchDailyEvents(date);
                } else {
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error initializing GAPI client:', error);
                setError('Error initializing Google API client');
                setIsLoading(false);
            }
        });
    };

    const initGoogleIdentity = () => {
        window.google?.accounts?.oauth2.initialize({
            client_id: CLIENT_ID,
            callback: handleCredentialResponse,
            scope: SCOPES + ' https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        });
    };

    const handleCredentialResponse = async (response: any) => {
        if (response.access_token) {
            // Store the token
            const tokenObj = {
                access_token: response.access_token,
                expires_at: Date.now() + (response.expires_in * 1000),
            };
            sessionStorage.setItem('gapi-token', JSON.stringify(tokenObj));

            // Set the token for GAPI
            window.gapi.client.setToken(tokenObj);

            setIsAuthenticated(true);
            fetchUserInfo();
            fetchDailyEvents(date);
        }
    };

    const fetchUserInfo = async () => {
        try {
            const response = await window.gapi.client.request({
                'path': 'https://www.googleapis.com/oauth2/v3/userinfo',
            });

            const userProfile = response.result;
            setUserInfo({
                name: userProfile.name,
                email: userProfile.email,
                picture: userProfile.picture
            });
        } catch (error) {
            console.error('Error fetching user info:', error);
        }
    };

    const handleAuthClick = () => {
        // Replace the non-existing requestAccessToken method with the correct approach
        const tokenClient = window.google?.accounts?.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES + ' https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
            callback: handleCredentialResponse
        });

        if (tokenClient) {
            tokenClient.requestAccessToken();
        } else {
            setError("Google Authentication API not loaded properly");
        }
    };

    const handleSignoutClick = () => {
        // Clear token from client and storage
        window.gapi.client.setToken(null);
        sessionStorage.removeItem('gapi-token');
        setIsAuthenticated(false);
        setEvents([]);
        setUserInfo(null);
    };

    const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(event.target.value);
        setDate(newDate);
        if (isAuthenticated) {
            fetchDailyEvents(newDate);
        }
    };

    const fetchDailyEvents = async (date: Date) => {
        try {
            setIsLoading(true);
            const { startOfDay, endOfDay } = getDayBoundaries(date);

            const response = await window.gapi.client.calendar.events.list({
                'calendarId': 'primary',
                'timeMin': startOfDay.toISOString(),
                'timeMax': endOfDay.toISOString(),
                'showDeleted': false,
                'singleEvents': true,
                'maxResults': 100,
                'orderBy': 'startTime'
            });

            console.log('Successfully fetched events:', response.result.items);
            setEvents(response.result.items);
            setIsLoading(false);
        } catch (error: any) {
            console.error('API Error Details:', error);
            setError(`Error fetching calendar events: ${error.message || 'Unknown error'}`);
            setIsLoading(false);



            // If token expired, clear it
            if (error.status === 401) {
                sessionStorage.removeItem('gapi-token');
                setIsAuthenticated(false);
            }
        }
    };

    // Get start and end of selected day
    const getDayBoundaries = (date: Date) => {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return { startOfDay, endOfDay };
    };

    // Helper function to format time
    const formatTime = (dateTimeStr: string) => {
        return new Date(dateTimeStr).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Calculate event duration in minutes
    const getEventDuration = (start: string, end: string) => {
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        return Math.round((endTime - startTime) / 60000); // converts ms to minutes
    };

    return (
        <div className="bg-[#9ACBD0] bg-opacity-20 min-h-screen p-6 font-sans">
            <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="bg-[#27548A] text-white p-5">
                    <h2 className="text-2xl font-bold">Daily Calendar Events</h2>
                </div>

                <div className="p-6">
                    <div className="user-info-section flex items-center justify-between mb-6 bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center gap-3">
                            {userInfo?.picture && (
                                <img
                                    src={userInfo.picture}
                                    alt="Profile"
                                    className="w-10 h-10 rounded-full"
                                />
                            )}
                            <p className="text-gray-700">
                                Current User: <span className="font-semibold">{userInfo?.name || 'Guest'}</span>
                            </p>
                        </div>

                        {!isAuthenticated ? (
                            <button
                                onClick={handleAuthClick}
                                className="bg-[#48A6A7] hover:bg-[#006A71] text-white px-4 py-2 rounded transition duration-200"
                            >
                                Sign in with Google
                            </button>
                        ) : (
                            <button
                                onClick={handleSignoutClick}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded transition duration-200"
                            >
                                Sign Out
                            </button>
                        )}
                    </div>

                    {isAuthenticated && (
                        <div className="date-selector mb-6">
                            <label
                                htmlFor="date-picker"
                                className="block text-[#006A71] font-medium mb-2"
                            >
                                Select Date:
                            </label>
                            <input
                                type="date"
                                id="date-picker"
                                value={date.toISOString().split('T')[0]}
                                onChange={handleDateChange}
                                className="border border-[#9ACBD0] rounded p-2 focus:outline-none focus:ring-2 focus:ring-[#48A6A7]"
                            />
                        </div>
                    )}

                    {isLoading &&
                        <div className="flex justify-center my-8">
                            <p className="text-[#006A71] font-medium">Loading events...</p>
                        </div>
                    }

                    {error &&
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 my-4">
                            <p className="text-red-700">{error}</p>
                        </div>
                    }

                    <div className="events-list">
                        <h3 className="text-xl font-bold text-[#27548A] mb-4 pb-2 border-b border-[#9ACBD0]">
                            Schedule for {date.toDateString()}
                        </h3>

                        {events.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead className="bg-[#48A6A7] text-white">
                                        <tr>
                                            <th className="p-3 text-left">Time</th>
                                            <th className="p-3 text-left">Event</th>
                                            <th className="p-3 text-left">Duration</th>
                                            <th className="p-3 text-left">Location</th>
                                            <th className="p-3 text-left">Attendees</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {events.map((event, index) => (
                                            <tr
                                                key={event.id}
                                                className={`border-b ${index % 2 === 0 ? 'bg-white' : 'bg-[#9ACBD0] bg-opacity-10'} hover:bg-gray-50`}
                                            >
                                                <td className="p-3">
                                                    <span className="font-medium text-[#006A71]">
                                                        {formatTime(event.start.dateTime)}
                                                    </span> - {formatTime(event.end.dateTime)}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-[#27548A]">{event.summary}</div>
                                                    {event.description &&
                                                        <div className="text-sm text-gray-600 mt-1">{event.description}</div>
                                                    }
                                                </td>
                                                <td className="p-3">
                                                    {getEventDuration(event.start.dateTime, event.end.dateTime)} min
                                                </td>
                                                <td className="p-3">{event.location || 'N/A'}</td>
                                                <td className="p-3">
                                                    {event.attendees ?
                                                        <span className="px-2 py-1 bg-[#48A6A7] bg-opacity-10 rounded-full text-sm">
                                                            {event.attendees.length} attendee(s)
                                                        </span> :
                                                        <span className="text-gray-500">Just you</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-10 bg-gray-50 rounded-lg">
                                <p className="text-gray-500">No events scheduled for this day.</p>
                            </div>
                        )}

                        {events.length > 0 && (
                            <div className="daily-summary mt-8 bg-[#27548A] bg-opacity-10 rounded-lg p-5">
                                <h3 className="text-xl font-bold text-[#27548A] mb-3">Daily Summary</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-3 bg-white rounded shadow-sm">
                                        <p className="text-[#48A6A7] font-medium">Total events</p>
                                        <p className="text-2xl font-bold">{events.length}</p>
                                    </div>
                                    <div className="p-3 bg-white rounded shadow-sm">
                                        <p className="text-[#48A6A7] font-medium">First event</p>
                                        <p className="font-bold">{events[0]?.summary}</p>
                                        <p className="text-sm text-gray-600">at {formatTime(events[0]?.start.dateTime)}</p>
                                    </div>
                                    <div className="p-3 bg-white rounded shadow-sm">
                                        <p className="text-[#48A6A7] font-medium">Last event</p>
                                        <p className="font-bold">{events[events.length - 1]?.summary}</p>
                                        <p className="text-sm text-gray-600">at {formatTime(events[events.length - 1]?.start.dateTime)}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

};

// Add types to window object
declare global {
    interface Window {
        gapi: any;
        google?: {
            accounts?: {
                oauth2: any;
            };
        };
    }
}

export default CalendarData;


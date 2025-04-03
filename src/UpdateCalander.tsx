// Function to update Google Calendar with optimized schedule
import { GeneratedSchedule } from './types';

// Add this debug helper function
const debugGoogleAPI = () => {
    console.log("GAPI Client Status:", {
        isLoaded: !!window.gapi,
        hasClientAPI: !!(window.gapi && window.gapi.client),
        hasCalendarAPI: !!(window.gapi && window.gapi.client && window.gapi.client.calendar),
        currentToken: sessionStorage.getItem('gapi-token') ? 'Token exists' : 'No token found'
    });
};

export const updateCalendarWithSchedule = async(
    generatedSchedule: GeneratedSchedule,
    selectedDate: string
): Promise<{ success: boolean; message: string }> => {
    try {
        console.log("Starting calendar update process");
        debugGoogleAPI();

        // Check if Google API is loaded
        if (!window.gapi) {
            console.error("Google API not loaded");
            return {
                success: false,
                message: 'Google API not loaded. Please refresh the page and try again.',
            };
        }

        if (!window.gapi.client) {
            console.error("Google API Client not initialized");
            return {
                success: false,
                message: 'Google API Client not initialized. Please sign in again.',
            };
        }

        // Check if Calendar API is loaded
        if (!window.gapi.client.calendar) {
            console.error("Calendar API not available");
            // Try to load Calendar API dynamically
            try {
                console.log("Attempting to load Calendar API dynamically");
                await window.gapi.client.load('calendar', 'v3');
                console.log("Calendar API loaded successfully");
            } catch (loadError) {
                console.error("Failed to load Calendar API:", loadError);
                return {
                    success: false,
                    message: 'Calendar API not available. Please make sure you granted calendar access and try again.',
                };
            }
        }

        // Check if user is authenticated
        const tokenStr = sessionStorage.getItem('gapi-token');
        if (!tokenStr) {
            return {
                success: false,
                message: 'Authentication required. Please sign in to Google Calendar first.',
            };
        }

        // Parse the token and check if it's expired
        const token = JSON.parse(tokenStr);
        if (token.expires_at && token.expires_at < Date.now()) {
            console.error("Token has expired");
            return {
                success: false,
                message: 'Your session has expired. Please sign in again.',
            };
        }

        // Parse selected date
        const date = new Date(selectedDate);
        if (isNaN(date.getTime())) {
            return {
                success: false,
                message: 'Invalid date selected.',
            };
        }

        // Process each item in the schedule
        const eventsToCreate = [];
        for(let i = 0; i < generatedSchedule.schedule.length; i++) {
            const item = generatedSchedule.schedule[i];

            // Parse the time string (format: "HH:MM AM/PM")
            const timeParts = item.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (!timeParts) {
                console.warn(`Skipping item with invalid time format: ${ item.time } `);
                continue;
            }

            let hours = parseInt(timeParts[1]);
            const minutes = parseInt(timeParts[2]);
            const period = timeParts[3]?.toUpperCase();

            // Adjust hours for PM if in 12-hour format
            if (period === 'PM' && hours < 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;

            // Create start time
            const startDate = new Date(date);
            startDate.setHours(hours, minutes, 0, 0);

            // Estimate duration based on next event or default to 30 minutes
            let durationMinutes = 30;
            if (i < generatedSchedule.schedule.length - 1) {
                const nextItem = generatedSchedule.schedule[i + 1];
                const nextTimeParts = nextItem.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                if (nextTimeParts) {
                    let nextHours = parseInt(nextTimeParts[1]);
                    const nextMinutes = parseInt(nextTimeParts[2]);
                    const nextPeriod = nextTimeParts[3]?.toUpperCase();

                    if (nextPeriod === 'PM' && nextHours < 12) nextHours += 12;
                    if (nextPeriod === 'AM' && nextHours === 12) nextHours = 0;

                    const nextTime = new Date(date);
                    nextTime.setHours(nextHours, nextMinutes, 0, 0);
                    
                    // Calculate time difference in minutes
                    durationMinutes = (nextTime.getTime() - startDate.getTime()) / (1000 * 60);
                    
                    // Ensure minimum duration
                    durationMinutes = Math.max(15, durationMinutes);
                }
            }
            
            // Create end time
            const endDate = new Date(startDate.getTime() + (durationMinutes * 60 * 1000));
            
            // Create event object
            const event = {
                summary: item.task,
                description: `Priority: ${ item.priority || 'Medium' } \nAutomatically created by SmartPlanner`,
                start: {
                    dateTime: startDate.toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                end: {
                    dateTime: endDate.toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                },
                colorId: item.priority === 'High' ? '11' : item.priority === 'Medium' ? '5' : '9', // Red for High, Yellow for Medium, Green for Low
            };
            
            eventsToCreate.push(event);
            console.log(`Prepared event: "${item.task}" at ${ startDate.toLocaleTimeString() } `);
        }

        // Try using individual requests instead of batch if there are events to create
        if (eventsToCreate.length === 0) {
            return {
                success: false,
                message: 'No valid events to add to calendar.',
            };
        }

        console.log(`Attempting to create ${ eventsToCreate.length } events`);

        // Try using individual requests instead of batch
        const createdEvents = [];
        for (const eventData of eventsToCreate) {
            try {
                console.log(`Adding event: ${ eventData.summary } `);
                const response = await window.gapi.client.calendar.events.insert({
                    calendarId: 'primary',
                    resource: eventData
                });
                
                if (response && response.result) {
                    console.log(`Event created: ${ response.result.htmlLink } `);
                    createdEvents.push(response.result);
                }
            } catch (eventError) {
                console.error(`Failed to create event ${ eventData.summary }: `, eventError);
            }
        }

        if (createdEvents.length === 0) {
            console.error("No events were created successfully");
            return {
                success: false,
                message: 'Failed to create any events. Please check your Google Calendar permissions.',
            };
        }
        
        return {
            success: true,
            message: `Successfully added ${ createdEvents.length } events to your calendar.`,
        };
    } catch (error) {
        console.error('Error updating calendar:', error);
        return {
            success: false,
            message: `Failed to update calendar: ${ error instanceof Error ? error.message : String(error) } `,
        };
    }
};

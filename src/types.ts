// Shared types for the application
export interface Task {
    id: string;
    title: string;
    description?: string;
    priority: 'High' | 'Medium' | 'Low';
    timeFrame: string;
    duration: number; // in minutes
}

export interface ScheduleItem {
    time: string;
    task: string;
    priority?: string;
}

export interface GeneratedSchedule {
    schedule: ScheduleItem[];
}

export interface CalendarEvent {
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

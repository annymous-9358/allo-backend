// In-memory data (replace with database in production)

export const users = [
  { id: 1, username: 'frontdesk', password: 'password123', name: 'Front Desk Staff', role: 'staff' }
];

export const doctors = [
  {
    id: 1,
    name: 'Dr. John Smith',
    specialization: 'Cardiology',
    gender: 'Male',
    location: 'Main Building - 2nd Floor',
    availability: [
      { day: 'Monday', slots: ['09:00', '10:00', '11:00'] },
      { day: 'Wednesday', slots: ['14:00', '15:00', '16:00'] },
      { day: 'Friday', slots: ['09:00', '10:00', '11:00'] }
    ],
    imageUrl: 'https://via.placeholder.com/150'
  },
  {
    id: 2,
    name: 'Dr. Sarah Johnson',
    specialization: 'Pediatrics',
    gender: 'Female',
    location: "Children's Wing - 1st Floor",
    availability: [
      { day: 'Tuesday', slots: ['09:00', '10:00', '11:00'] },
      { day: 'Thursday', slots: ['09:00', '10:00', '11:00'] }
    ],
    imageUrl: 'https://via.placeholder.com/150'
  }
];

export const appointments = [
  { id: 1, patientId: 101, patientName: 'Alice Brown', doctorId: 1, doctorName: 'Dr. John Smith', dateTime: '2025-08-10T10:00:00', status: 'booked', reason: 'Regular checkup' },
  { id: 2, patientId: 102, patientName: 'Bob Taylor', doctorId: 2, doctorName: 'Dr. Sarah Johnson', dateTime: '2025-08-10T15:00:00', status: 'completed', reason: 'Flu symptoms' }
];

export const queue = [
  { id: 1, patientId: 106, patientName: 'Frank Lee', queueNumber: 1, status: 'waiting', arrivalTime: '2025-08-09T09:15:00', reason: 'High fever', priority: 'normal' },
  { id: 2, patientId: 107, patientName: 'Grace Kim', queueNumber: 2, status: 'with_doctor', arrivalTime: '2025-08-09T09:30:00', reason: 'Sore throat', priority: 'normal' },
];

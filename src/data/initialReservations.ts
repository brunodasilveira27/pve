import { ChaletCategory, Reservation, ReservationStatus } from '../types/chalet';
import { addDaysYMD, getLocalTodayYMD } from '../utils/validation';

export function createInitialReservations(): Reservation[] {
  const now = new Date().toISOString();
  const today = getLocalTodayYMD();

  return [
    {
      id: 'res-initial-1',
      chaletId: 4,
      chaletCode: '04',
      chaletLabel: 'Chalé 04',
      category: ChaletCategory.STAND,
      guestId: 'guest-4',
      guestName: 'Ana Lima',
      guestDocument: '987.654.321-00',
      guestPhone: '(24) 99201-4432',
      guestCount: 2,
      checkIn: addDaysYMD(today, 4),
      checkOut: addDaysYMD(today, 7),
      dailyRate: 350,
      depositPaid: 350,
      notes: 'Chegada prevista às 15h.',
      status: ReservationStatus.CONFIRMADA,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'res-initial-2',
      chaletId: 19,
      chaletCode: '19',
      chaletLabel: 'Casa',
      category: ChaletCategory.CASA,
      guestId: 'guest-9',
      guestName: 'Casal Mendes',
      guestDocument: '789.456.123-19',
      guestPhone: '(11) 99123-4098',
      guestCount: 4,
      checkIn: addDaysYMD(today, 8),
      checkOut: addDaysYMD(today, 11),
      dailyRate: 850,
      depositPaid: 850,
      notes: 'Reserva para feriado prolongado.',
      status: ReservationStatus.PENDENTE,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

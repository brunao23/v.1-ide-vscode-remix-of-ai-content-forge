import { useState } from 'react';
import { format, isSameMonth, isSameDay, parseISO, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { EventCard } from '@/components/calendar/EventCard';

export default function CalendarPage() {
  const { events, loading, error } = useCalendarEvents();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthEvents = events.filter(e => {
    try { return isSameMonth(parseISO(e.start), currentMonth); } catch { return false; }
  });

  const selectedDateEvents = selectedDate
    ? events.filter(e => { try { return isSameDay(parseISO(e.start), selectedDate); } catch { return false; } })
    : [];

  const upcomingEvents = events
    .filter(e => { try { return isAfter(parseISO(e.start), new Date()); } catch { return false; } })
    .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime());

  const prevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // Which events to show in main area
  const displayEvents = selectedDate ? selectedDateEvents : upcomingEvents;
  const displayTitle = selectedDate
    ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })
    : 'Próximos eventos';
  const displayCount = displayEvents.length;

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-[280px] shrink-0 border-b md:border-b-0 md:border-r border-border p-4 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <div className="flex gap-1">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <CalendarGrid
          currentMonth={currentMonth}
          events={monthEvents}
          selectedDate={selectedDate}
          onSelectDate={(date) => setSelectedDate(prev => prev && isSameDay(prev, date) ? null : date)}
        />

        {/* Clear filter */}
        {selectedDate && (
          <button
            onClick={() => setSelectedDate(null)}
            className="w-full text-xs py-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
          >
            ← Ver todos os próximos eventos
          </button>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-2xl space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground capitalize">{displayTitle}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{displayCount} evento(s)</p>
          </div>

          <div className="space-y-3">
            {displayEvents.length > 0 ? (
              displayEvents.map(event => (
                <EventCard key={event.id} event={event} showDate={!selectedDate} />
              ))
            ) : (
              <div className="rounded-[10px] bg-secondary border border-border p-8 text-center">
                <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {selectedDate ? 'Nenhum evento nesta data' : 'Nenhum evento futuro encontrado'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

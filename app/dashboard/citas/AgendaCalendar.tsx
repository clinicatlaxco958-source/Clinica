"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
  type SlotInfo,
} from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  endOfWeek,
  startOfDay,
  endOfDay,
} from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { createClient } from "@/lib/supabase/client";
import NewAppointmentModal, {
  type NewAppointmentDefaults,
} from "./NewAppointmentModal";
import AppointmentDetailModal, {
  type AppointmentDetail,
} from "./AppointmentDetailModal";

const locales = { es };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const messages = {
  today: "Hoy",
  previous: "Atrás",
  next: "Siguiente",
  month: "Mes",
  week: "Semana",
  day: "Día",
  date: "Fecha",
  time: "Hora",
  event: "Cita",
  noEventsInRange: "No hay citas en este rango.",
  showMore: (total: number) => `+ ${total} más`,
};

const statusColors: Record<string, string> = {
  pendiente: "#d97706",
  confirmada: "#2563eb",
  completada: "#16a34a",
  cancelada: "#94a3b8",
  no_show: "#dc2626",
};

type Doctor = {
  id: string;
  fullName: string;
  specialty: string | null;
  defaultDurationMinutes: number | null;
  workStartTime: string | null;
  workEndTime: string | null;
};

type AppointmentEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: string;
  paymentStatus: string;
  doctorId: string | null;
  doctorName: string | null;
  patientPhone: string | null;
  patientEmail: string | null;
  dateStr: string;
  startTimeStr: string;
  endTimeStr: string;
  notes: string | null;
  hasVitals: boolean;
};

function timeToDateOnDay(day: Date, timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const result = new Date(day);
  result.setHours(h, m, 0, 0);
  return result;
}

function getVisibleRange(date: Date, view: View) {
  if (view === Views.MONTH) {
    return {
      start: startOfWeek(startOfMonth(date), { locale: es }),
      end: endOfWeek(endOfMonth(date), { locale: es }),
    };
  }
  if (view === Views.WEEK) {
    return {
      start: startOfWeek(date, { locale: es }),
      end: endOfWeek(date, { locale: es }),
    };
  }
  return { start: startOfDay(date), end: endOfDay(date) };
}

export default function AgendaCalendar({
  clinicId,
  clinicDefaultDuration,
  clinicDefaultWorkStart,
  clinicDefaultWorkEnd,
  doctors,
  defaultDoctorId,
  canViewAllDoctors,
}: {
  clinicId: string;
  clinicDefaultDuration: number;
  clinicDefaultWorkStart: string;
  clinicDefaultWorkEnd: string;
  doctors: Doctor[];
  defaultDoctorId: string | null;
  canViewAllDoctors: boolean;
}) {
  const supabase = createClient();
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<View>(Views.DAY);
  const [doctorFilter, setDoctorFilter] = useState(defaultDoctorId ?? "all");
  const [events, setEvents] = useState<AppointmentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaults, setModalDefaults] =
    useState<NewAppointmentDefaults | null>(null);
  const [detailAppointment, setDetailAppointment] =
    useState<AppointmentDetail | null>(null);

  const range = useMemo(() => getVisibleRange(date, view), [date, view]);
  const rangeStart = range.start.getTime();
  const rangeEnd = range.end.getTime();

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === doctorFilter) ?? null,
    [doctors, doctorFilter]
  );

  const gridConfig = useMemo(() => {
    const step = selectedDoctor?.defaultDurationMinutes ?? (selectedDoctor ? clinicDefaultDuration : 30);
    const workStart = selectedDoctor?.workStartTime ?? clinicDefaultWorkStart;
    const workEnd = selectedDoctor?.workEndTime ?? clinicDefaultWorkEnd;
    return {
      step,
      min: timeToDateOnDay(date, workStart),
      max: timeToDateOnDay(date, workEnd),
    };
  }, [selectedDoctor, clinicDefaultDuration, clinicDefaultWorkStart, clinicDefaultWorkEnd, date]);

  useEffect(() => {
    let cancelled = false;

    async function loadAppointments() {
      setLoading(true);

      let query = supabase
        .from("appointments")
        .select(
          "id, date, start_time, end_time, status, payment_status, notes, doctor_id, patients(full_name, phone, email), doctors(specialty, users(full_name)), consultations(weight_kg, height_cm, temperature_c, blood_pressure)"
        )
        .gte("date", format(rangeStart, "yyyy-MM-dd"))
        .lte("date", format(rangeEnd, "yyyy-MM-dd"))
        .order("start_time");

      if (doctorFilter !== "all") {
        query = query.eq("doctor_id", doctorFilter);
      }

      const { data } = await query;
      if (cancelled) return;

      const mapped: AppointmentEvent[] = (data ?? []).map((apt: any) => {
        const c = apt.consultations;
        const hasVitals = !!(
          c &&
          (c.weight_kg != null ||
            c.height_cm != null ||
            c.temperature_c != null ||
            (c.blood_pressure && c.blood_pressure.trim() !== ""))
        );
        return {
        id: apt.id,
        title: apt.patients?.full_name ?? "Paciente",
        start: parse(
          `${apt.date} ${apt.start_time.slice(0, 5)}`,
          "yyyy-MM-dd HH:mm",
          new Date()
        ),
        end: parse(
          `${apt.date} ${apt.end_time.slice(0, 5)}`,
          "yyyy-MM-dd HH:mm",
          new Date()
        ),
        status: apt.status,
        paymentStatus: apt.payment_status,
        doctorId: apt.doctor_id,
        doctorName: apt.doctors?.users?.full_name ?? null,
        patientPhone: apt.patients?.phone ?? null,
        patientEmail: apt.patients?.email ?? null,
        dateStr: apt.date,
        startTimeStr: apt.start_time.slice(0, 5),
        endTimeStr: apt.end_time.slice(0, 5),
        notes: apt.notes,
        hasVitals,
        };
      });

      setEvents(mapped);
      setLoading(false);
    }

    loadAppointments();
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, doctorFilter, refreshKey, supabase]);

  const eventPropGetter = useCallback(
    (event: AppointmentEvent) => ({
      style: {
        backgroundColor: statusColors[event.status] ?? "#64748b",
        borderRadius: "6px",
        border: "none",
        color: "white",
      },
    }),
    []
  );

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      if (view === Views.MONTH) {
        // En vista mes, un clic navega al día para ver huecos reales
        // antes de agendar, en vez de abrir el formulario a ciegas.
        setDate(slotInfo.start);
        setView(Views.DAY);
        return;
      }
      setModalDefaults({
        date: format(slotInfo.start, "yyyy-MM-dd"),
        startTime: format(slotInfo.start, "HH:mm"),
        doctorId: doctorFilter !== "all" ? doctorFilter : null,
      });
      setModalOpen(true);
    },
    [view, doctorFilter]
  );

  const handleSelectEvent = useCallback((event: AppointmentEvent) => {
    setDetailAppointment({
      id: event.id,
      patientName: event.title,
      patientPhone: event.patientPhone,
      patientEmail: event.patientEmail,
      doctorId: event.doctorId,
      doctorName: event.doctorName,
      date: event.dateStr,
      startTime: event.startTimeStr,
      endTime: event.endTimeStr,
      status: event.status,
      paymentStatus: event.paymentStatus,
      notes: event.notes,
      hasVitals: event.hasVitals,
    });
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Agenda</h1>
          <p className="text-sm text-slate-500">
            {loading
              ? "Cargando..."
              : `${events.length} cita(s) en este rango · haz clic en un espacio libre del calendario para agendar`}
          </p>
        </div>

        {canViewAllDoctors ? (
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Todos los doctores</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
                {d.specialty ? ` (${d.specialty})` : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-slate-500">Mi agenda</span>
        )}
      </div>

      <div
        className={`relative rounded-xl border border-slate-200 bg-white p-4 transition-opacity ${
          loading ? "opacity-50" : ""
        }`}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" />
          </div>
        )}
        <Calendar
          localizer={localizer}
          culture="es"
          messages={messages}
          events={events}
          date={date}
          view={view}
          onNavigate={setDate}
          onView={setView}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          eventPropGetter={eventPropGetter}
          selectable
          popup
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          step={gridConfig.step}
          timeslots={1}
          min={gridConfig.min}
          max={gridConfig.max}
          style={{ height: 650 }}
        />
      </div>

      <NewAppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
        clinicId={clinicId}
        doctors={doctors}
        clinicDefaultDuration={clinicDefaultDuration}
        clinicDefaultWorkStart={clinicDefaultWorkStart}
        clinicDefaultWorkEnd={clinicDefaultWorkEnd}
        defaults={modalDefaults}
      />

      <AppointmentDetailModal
        appointment={detailAppointment}
        onClose={() => setDetailAppointment(null)}
        onUpdated={() => setRefreshKey((k) => k + 1)}
        doctors={doctors}
        canReassignDoctor={canViewAllDoctors}
        currentUserDoctorId={defaultDoctorId}
      />
    </div>
  );
}

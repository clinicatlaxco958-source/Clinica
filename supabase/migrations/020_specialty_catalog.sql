-- ============================================================
-- Migración 020: especialidad de doctor pasa de texto libre a un
-- catálogo controlado (ver lib/specialties.ts y NEGOCIO.md sección 13).
--
-- Por qué: nada impedía registrar a un doctor con una especialidad que
-- no correspondiera a la clínica, y no había forma estructurada de saber
-- el "área" (médica/dental) de cada doctor — necesaria para decidir qué
-- bloque de la historia clínica exigir en cada cita (antes se decidía
-- por `clinics.type`, a nivel de toda la clínica, lo cual causaba que
-- una clínica mixta exigiera el bloque médico Y el dental juntos para
-- siempre, ver NEGOCIO.md). Ahora se decide por la especialidad del
-- doctor de esa cita en particular.
--
-- Catálogo inicial: 'medico_general' (área médica), 'dentista' (área
-- dental). Ampliar la lista más adelante es otra migración chica.
--
-- La app todavía no está en uso oficial (sin pacientes/doctores reales
-- con datos que preservar) — por indicación explícita de Tony, esta
-- migración resetea cualquier valor de especialidad que no calce con el
-- catálogo nuevo, en vez de intentar adivinar/migrar el texto libre
-- anterior. Después de correrla, hay que volver a elegir la especialidad
-- de cada doctor desde el nuevo menú (perfil o alta de usuario).
--
-- Seguro de volver a correr.
-- ============================================================

update doctors
  set specialty = null
  where specialty is not null
    and specialty not in ('medico_general', 'dentista');

alter table doctors drop constraint if exists doctors_specialty_check;
alter table doctors add constraint doctors_specialty_check
  check (specialty in ('medico_general', 'dentista'));

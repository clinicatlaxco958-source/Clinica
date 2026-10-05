-- ============================================================
-- Migración 023: grupo étnico, campo opcional de la ficha de
-- identificación. NOM-004-SSA3-2012 numeral 6.1.1 lo lista dentro del
-- interrogatorio junto a la ficha de identificación, con la salvedad
-- "en su caso" — por eso, a diferencia de CURP/domicilio/etc., este
-- campo NO cuenta para el aviso de "datos pendientes" (nunca se le
-- debe insistir al paciente por algo opcional).
--
-- Catálogo con los grupos más numerosos + "otro" de texto libre — no es
-- el catálogo oficial completo del INPI (68 pueblos reconocidos), solo
-- una lista práctica; "otro" cubre cualquiera que no esté listado.
--
-- Seguro de volver a correr.
-- ============================================================

alter table patients add column if not exists ethnic_group text;
alter table patients drop constraint if exists patients_ethnic_group_check;
alter table patients add constraint patients_ethnic_group_check
  check (ethnic_group in (
    'ninguno', 'nahuatl', 'maya', 'zapoteco', 'mixteco', 'otomi',
    'totonaca', 'tzeltal', 'tzotzil', 'mazahua', 'mazateco', 'huasteco',
    'chol', 'purepecha', 'mixe', 'chinanteco', 'afromexicano', 'otro'
  ));

alter table patients add column if not exists ethnic_group_detail text;

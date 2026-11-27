CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  clean_name text;
  clean_email text;
  clean_committee text;
  requested_committee text;
  requested_committees text[];
  assigned_role text := 'volunteer';
  assigned_committee text;
BEGIN
  clean_email := LOWER(TRIM(COALESCE(NEW.email, '')));
  clean_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    SPLIT_PART(clean_email, '@', 1)
  );

  SELECT COALESCE(array_agg(committee ORDER BY first_position), ARRAY[]::text[])
  INTO requested_committees
  FROM (
    SELECT UPPER(TRIM(selected.value)) AS committee, MIN(selected.ordinality) AS first_position
    FROM unnest(
      string_to_array(COALESCE(NEW.raw_user_meta_data ->> 'committee', ''), ',')
    ) WITH ORDINALITY AS selected(value, ordinality)
    WHERE TRIM(selected.value) <> ''
    GROUP BY UPPER(TRIM(selected.value))
  ) AS requested;

  IF cardinality(requested_committees) BETWEEN 1 AND 2
     AND NOT EXISTS (
       SELECT 1
       FROM unnest(requested_committees) AS chosen(committee)
       WHERE chosen.committee NOT IN (
         'CORE', 'HR', 'PR', 'LOGISTICS', 'PROGRAMMING', 'MEDIA'
       )
     )
  THEN
    requested_committee := array_to_string(requested_committees, ', ');
  ELSE
    requested_committee := NULL;
  END IF;

  SELECT 'head', dh.committee
  INTO assigned_role, assigned_committee
  FROM public.designated_heads AS dh
  WHERE LOWER(TRIM(dh.email)) = clean_email;

  IF NOT FOUND THEN
    assigned_role := 'volunteer';
    clean_committee := requested_committee;
  ELSE
    clean_committee := assigned_committee;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    requested_role,
    committee,
    role_approved,
    approval_status,
    is_active
  )
  VALUES (
    NEW.id,
    NEW.email,
    clean_name,
    assigned_role,
    assigned_role,
    clean_committee,
    TRUE,
    'approved',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    committee = EXCLUDED.committee,
    role = CASE
      WHEN public.profiles.role = 'admin' THEN public.profiles.role
      ELSE EXCLUDED.role
    END;

  INSERT INTO public.students (id, full_name, email, committee, total_hours)
  VALUES (NEW.id, clean_name, NEW.email, clean_committee, 0)
  ON CONFLICT (email) DO UPDATE
  SET
    id = EXCLUDED.id,
    full_name = EXCLUDED.full_name,
    committee = EXCLUDED.committee;

  RETURN NEW;
END;
$function$;

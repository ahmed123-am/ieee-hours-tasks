CREATE OR REPLACE FUNCTION public.update_own_name(new_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  normalized_name text := BTRIM(new_full_name);
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF normalized_name IS NULL OR CHAR_LENGTH(normalized_name) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Name must contain between 1 and 100 characters';
  END IF;

  UPDATE public.profiles
  SET full_name = normalized_name, updated_at = NOW()
  WHERE id = current_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  UPDATE public.students
  SET full_name = normalized_name
  WHERE id = current_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_own_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_name(text) TO authenticated;

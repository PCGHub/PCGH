-- Hosted staging only: rollback-only Flutterwave credit settlement accounting checks.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pcgh-payment-e2e@example.invalid','',now(),now(),now());
INSERT INTO public.users(id,email,username,credits) VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3','pcgh-payment-e2e@example.invalid','staging_payment',0);
INSERT INTO public.credit_orders(reference,user_id,credits,amount_naira) VALUES
('pcgh_staging_payment_1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',500,500),
('pcgh_staging_payment_2','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',500,500);
DO $test$
DECLARE outcome jsonb; balance numeric; status1 text; status2 text;
BEGIN
 BEGIN
  PERFORM public.settle_credit_order('pcgh_staging_payment_1','staging_provider_1',499,'NGN');
  RAISE EXCEPTION 'Mismatched amount unexpectedly accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Mismatched amount unexpectedly accepted' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.settle_credit_order('pcgh_staging_payment_1','staging_provider_1',500,'USD');
  RAISE EXCEPTION 'Wrong currency unexpectedly accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Wrong currency unexpectedly accepted' THEN RAISE; END IF;
 END;
 SELECT credits INTO balance FROM public.users WHERE username='staging_payment';
 IF balance<>0 THEN RAISE EXCEPTION 'Rejected settlement credited balance'; END IF;
 outcome:=public.settle_credit_order('pcgh_staging_payment_1','staging_provider_1',500,'NGN');
 IF outcome->>'ok'<>'true' THEN RAISE EXCEPTION 'Successful settlement not acknowledged'; END IF;
 outcome:=public.settle_credit_order('pcgh_staging_payment_1','staging_provider_1',500,'NGN');
 IF outcome->>'duplicate'<>'true' THEN RAISE EXCEPTION 'Duplicate settlement not detected'; END IF;
 SELECT credits INTO balance FROM public.users WHERE username='staging_payment';
 IF balance<>500 THEN RAISE EXCEPTION 'Idempotent credit balance wrong: %',balance; END IF;
 BEGIN
  PERFORM public.settle_credit_order('pcgh_staging_payment_2','staging_provider_1',500,'NGN');
  RAISE EXCEPTION 'Provider transaction replay unexpectedly accepted';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Provider transaction replay unexpectedly accepted' THEN RAISE; END IF;
 END;
 SELECT credits INTO balance FROM public.users WHERE username='staging_payment';
 SELECT status INTO status1 FROM public.credit_orders WHERE reference='pcgh_staging_payment_1';
 SELECT status INTO status2 FROM public.credit_orders WHERE reference='pcgh_staging_payment_2';
 IF balance<>500 OR status1<>'completed' OR status2<>'pending' THEN RAISE EXCEPTION 'Replay protection/accounting incorrect'; END IF;
END $test$;
SELECT 'PASS: amount, currency, duplicate callback, and provider replay settlement controls' AS result;
ROLLBACK;
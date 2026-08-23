-- Admin-editable email branding (logo/header/footer applied to every
-- transactional email) plus body copy for the registration and login mails.

INSERT INTO adm_settings (key, label, category, is_secret) VALUES
  ('email_logo_url',            'Email Logo URL',            'email_branding', FALSE),
  ('email_header',              'Email Header',              'email_branding', FALSE),
  ('email_footer',              'Email Footer',              'email_branding', FALSE),
  ('email_body_registration',   'Registration Email Body',   'email_branding', FALSE),
  ('email_body_login',          'Login / Password Email Body', 'email_branding', FALSE)
ON CONFLICT (key) DO NOTHING;

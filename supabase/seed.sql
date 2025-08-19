-- RushRank Seed Data
-- Bootstrap system with initial chapter and admin user

-- Insert initial chapter (RushRank HQ for system administration)
INSERT INTO chapters (id, name, domain_allowlist) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'RushRank HQ', '{}')
ON CONFLICT DO NOTHING;

-- Note: The actual system admin user will be created when they first log in via Supabase Auth
-- Their user record will be automatically created in the users table via trigger or manual insertion

-- Function to automatically create user record when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO UPDATE SET email = NEW.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user record on auth.users insert
-- Note: This trigger references Supabase's auth.users table
-- Uncomment when running in Supabase environment
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Sample data for development/testing
-- Uncomment these lines after system admin creates a chapter

-- Sample chapter
-- INSERT INTO chapters (id, name, domain_allowlist) VALUES 
--     ('11111111-1111-1111-1111-111111111111', 'Alpha Beta Gamma', '{"university.edu"}');

-- Sample PNMs
-- INSERT INTO pnms (chapter_id, name, major, hometown, year, tags) VALUES 
--     ('11111111-1111-1111-1111-111111111111', 'John Smith', 'Computer Science', 'Dallas, TX', 'sophomore', '{"athlete", "funny"}'),
--     ('11111111-1111-1111-1111-111111111111', 'Mike Johnson', 'Business', 'Austin, TX', 'freshman', '{"legacy", "outgoing"}'),
--     ('11111111-1111-1111-1111-111111111111', 'David Wilson', 'Engineering', 'Houston, TX', 'junior', '{"smart", "quiet"}');

-- Sample events
-- INSERT INTO events (chapter_id, name, description, date, type, location) VALUES 
--     ('11111111-1111-1111-1111-111111111111', 'Rush Mixer', 'Meet the brothers', NOW() + INTERVAL '1 day', 'optional', 'Chapter House'),
--     ('11111111-1111-1111-1111-111111111111', 'Formal Dinner', 'Formal rush dinner', NOW() + INTERVAL '3 days', 'mandatory', 'University Club');
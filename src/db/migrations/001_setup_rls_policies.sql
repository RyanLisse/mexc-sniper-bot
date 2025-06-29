-- Row Level Security Policies for MEXC Sniper Bot
-- This migration sets up comprehensive RLS policies to ensure data security

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_system_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE snipe_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_summary ENABLE ROW LEVEL SECURITY;

-- User table policies
-- Users can only see and update their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies
-- Users can view their own roles, admins can view all
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Only admins can manage roles
CREATE POLICY "Only admins can manage roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Workflow system status policies
-- Users can view global system status, only system can update
CREATE POLICY "All authenticated users can view system status" ON workflow_system_status
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only service role can update system status" ON workflow_system_status
  FOR ALL USING (auth.role() = 'service_role');

-- Workflow activity policies
-- Users can only see their own workflow activities
CREATE POLICY "Users can view own workflow activities" ON workflow_activity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create workflow activities" ON workflow_activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Coin activities policies
-- Users can only access their own coin activities
CREATE POLICY "Users can view own coin activities" ON coin_activities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create coin activities" ON coin_activities
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own coin activities" ON coin_activities
  FOR UPDATE USING (auth.uid() = user_id);

-- Snipe targets policies
-- Users can only access their own snipe targets
CREATE POLICY "Users can view own snipe targets" ON snipe_targets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own snipe targets" ON snipe_targets
  FOR ALL USING (auth.uid() = user_id);

-- User preferences policies
-- Users can only access their own preferences
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- API credentials policies (highly sensitive)
-- Users can only access their own API credentials
CREATE POLICY "Users can view own API credentials" ON api_credentials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own API credentials" ON api_credentials
  FOR ALL USING (auth.uid() = user_id);

-- Execution history policies
-- Users can only see their own execution history
CREATE POLICY "Users can view own execution history" ON execution_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create execution history" ON execution_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions policies
-- Users can only access their own transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);

-- Transaction locks policies
-- Users can only access their own transaction locks
CREATE POLICY "Users can view own transaction locks" ON transaction_locks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own transaction locks" ON transaction_locks
  FOR ALL USING (auth.uid() = user_id);

-- Balance snapshots policies
-- Users can only access their own balance snapshots
CREATE POLICY "Users can view own balance snapshots" ON balance_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create balance snapshots" ON balance_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Portfolio summary policies
-- Users can only access their own portfolio summary
CREATE POLICY "Users can view own portfolio summary" ON portfolio_summary
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own portfolio summary" ON portfolio_summary
  FOR ALL USING (auth.uid() = user_id);

-- Create a function to handle user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, name, email_verified, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email_confirmed_at IS NOT NULL,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name),
    email_verified = EXCLUDED.email_verified,
    updated_at = EXCLUDED.updated_at;
  
  -- Assign default role
  INSERT INTO user_roles (user_id, role, assigned_at)
  VALUES (NEW.id, 'user', NOW())
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create indexes for better performance with RLS
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_activities_user_id ON coin_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_snipe_targets_user_id ON snipe_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_api_credentials_user_id ON api_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_history_user_id ON execution_history(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_snapshots_user_id ON balance_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_summary_user_id ON portfolio_summary(user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Revoke unnecessary permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Grant specific read permissions to anon for public data
GRANT SELECT ON workflow_system_status TO anon;

COMMENT ON POLICY "Users can view own profile" ON users IS 'Users can only view their own profile data';
COMMENT ON POLICY "Users can view own coin activities" ON coin_activities IS 'Users can only access their own trading activities';
COMMENT ON POLICY "Users can view own API credentials" ON api_credentials IS 'Strict isolation of API credentials per user';
COMMENT ON POLICY "Users can view own transactions" ON transactions IS 'Financial data is strictly segregated by user';
-- 0010_fraternity_colors.sql
CREATE TABLE IF NOT EXISTS fraternity_colors (
  key            TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  rank           INT  NOT NULL,
  hex_primary    TEXT NOT NULL,
  hex_secondary  TEXT,
  hex_tertiary   TEXT
);

CREATE INDEX IF NOT EXISTS fraternity_colors_name_lower_idx
  ON fraternity_colors (lower(name));

INSERT INTO fraternity_colors (key, name, rank, hex_primary, hex_secondary, hex_tertiary) VALUES
('tau_kappa_epsilon',   'Tau Kappa Epsilon',   1,  '#D2042D', '#808080', NULL),
('kappa_sigma',         'Kappa Sigma',          2,  '#FF2400', '#FFFFFF', '#50C878'),
('sigma_alpha_epsilon', 'Sigma Alpha Epsilon',  3,  '#4B0082', '#CFB53B', NULL),
('sigma_chi',           'Sigma Chi',            4,  '#0033A0', '#CFB53B', NULL),
('sigma_phi_epsilon',   'Sigma Phi Epsilon',    5,  '#C8102E', '#4B0082', '#D4AF37'),
('pi_kappa_alpha',      'Pi Kappa Alpha',       6,  '#782F40', '#CFB53B', NULL),
('lambda_chi_alpha',    'Lambda Chi Alpha',     7,  '#4B0082', '#008000', '#FFD700'),
('pi_kappa_phi',        'Pi Kappa Phi',         8,  '#FFFFFF', '#D4AF37', NULL),
('sigma_nu',            'Sigma Nu',             9,  '#FFFFFF', '#D4AF37', '#000000'),
('phi_delta_theta',     'Phi Delta Theta',     10, '#007FFF', '#C0C0C0', NULL),
('alpha_phi_alpha',     'Alpha Phi Alpha',     11, '#000000', '#D4AF37', NULL),
('kappa_alpha_psi',     'Kappa Alpha Psi',     12, '#DC143C', '#FFFDD0', NULL),
('omega_psi_phi',       'Omega Psi Phi',       13, '#4B0082', '#CFB53B', NULL),
('iota_phi_theta',      'Iota Phi Theta',      14, '#3B2F2F', '#D4AF37', NULL),
('alpha_tau_omega',     'Alpha Tau Omega',     15, '#007FFF', '#CFB53B', NULL),
('beta_theta_pi',       'Beta Theta Pi',       16, '#FFC0CB', '#0033A0', NULL),
('delta_tau_delta',     'Delta Tau Delta',     17, '#4B0082', '#FFFFFF', '#FFD700'),
('delta_upsilon',       'Delta Upsilon',       18, '#CFB53B', '#0F52BA', NULL),
('phi_gamma_delta',     'Phi Gamma Delta',     19, '#4B0082', '#FFFFFF', NULL),
('phi_kappa_psi',       'Phi Kappa Psi',       20, '#C41E3A', '#355E3B', NULL),
('phi_kappa_tau',       'Phi Kappa Tau',       21, '#A51C30', '#CFB53B', NULL),
('theta_chi',           'Theta Chi',           22, '#B22222', '#FFFFFF', NULL),
('zeta_beta_tau',       'Zeta Beta Tau',       23, '#0000CD', '#FFFFFF', NULL),
('delta_chi',           'Delta Chi',           24, '#C8102E', '#F0DC82', NULL),
('delta_sigma_phi',     'Delta Sigma Phi',     25, '#29AB87', '#FFFFFF', NULL),
('alpha_sigma_phi',     'Alpha Sigma Phi',     26, '#C41E3A', '#928E85', NULL),
('alpha_epsilon_pi',    'Alpha Epsilon Pi',    27, '#D4AF37', '#0033A0', NULL),
('kappa_alpha_order',   'Kappa Alpha Order',   28, '#DC143C', '#CFB53B', NULL),
('sigma_pi',            'Sigma Pi',            29, '#E6E6FA', '#FFFFFF', '#D4AF37'),
('phi_sigma_kappa',     'Phi Sigma Kappa',     30, '#C41E3A', '#C0C0C0', NULL)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  rank = EXCLUDED.rank,
  hex_primary = EXCLUDED.hex_primary,
  hex_secondary = EXCLUDED.hex_secondary,
  hex_tertiary = EXCLUDED.hex_tertiary;

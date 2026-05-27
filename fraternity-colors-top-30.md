# Top 30 Fraternity Colors — Hex Palette for Agent

Use this file as a practical seed palette for RushRank or any fraternity UI/data setup.

**Important note:** Most fraternities publish official color **names**, not official digital hex codes. The `officialColors` values below come from public fraternity color references, while the `hexColors` values are practical web approximations for app/UI use.

Sources used:
- Greek Gear fraternity color list for official color names
- GreekRank largest fraternity list for the initial largest-fraternity ordering
- NIC member fraternity list for broader national/inter-national fraternity context

## Markdown Table

| Rank | Fraternity | Key | Official Colors | Hex Colors |
|---:|---|---|---|---|
| 1 | Tau Kappa Epsilon | `tau_kappa_epsilon` | Cherry, Gray | `#D2042D`, `#808080` |
| 2 | Kappa Sigma | `kappa_sigma` | Scarlet, White, Emerald Green | `#FF2400`, `#FFFFFF`, `#50C878` |
| 3 | Sigma Alpha Epsilon | `sigma_alpha_epsilon` | Royal Purple, Old Gold | `#4B0082`, `#CFB53B` |
| 4 | Sigma Chi | `sigma_chi` | Blue, Old Gold | `#0033A0`, `#CFB53B` |
| 5 | Sigma Phi Epsilon | `sigma_phi_epsilon` | Red, Purple, Gold | `#C8102E`, `#4B0082`, `#D4AF37` |
| 6 | Pi Kappa Alpha | `pi_kappa_alpha` | Garnet, Old Gold | `#782F40`, `#CFB53B` |
| 7 | Lambda Chi Alpha | `lambda_chi_alpha` | Purple, Green, Yellow | `#4B0082`, `#008000`, `#FFD700` |
| 8 | Pi Kappa Phi | `pi_kappa_phi` | White, Gold | `#FFFFFF`, `#D4AF37` |
| 9 | Sigma Nu | `sigma_nu` | White, Gold, Black | `#FFFFFF`, `#D4AF37`, `#000000` |
| 10 | Phi Delta Theta | `phi_delta_theta` | Azure, Argent | `#007FFF`, `#C0C0C0` |
| 11 | Alpha Phi Alpha | `alpha_phi_alpha` | Black, Gold | `#000000`, `#D4AF37` |
| 12 | Kappa Alpha Psi | `kappa_alpha_psi` | Crimson, Crème | `#DC143C`, `#FFFDD0` |
| 13 | Omega Psi Phi | `omega_psi_phi` | Royal Purple, Old Gold | `#4B0082`, `#CFB53B` |
| 14 | Iota Phi Theta | `iota_phi_theta` | Charcoal Brown, Gilded Gold | `#3B2F2F`, `#D4AF37` |
| 15 | Alpha Tau Omega | `alpha_tau_omega` | Azure Blue, Old Gold | `#007FFF`, `#CFB53B` |
| 16 | Beta Theta Pi | `beta_theta_pi` | Pink, Blue | `#FFC0CB`, `#0033A0` |
| 17 | Delta Tau Delta | `delta_tau_delta` | Royal Purple, White, Yellow Gold | `#4B0082`, `#FFFFFF`, `#FFD700` |
| 18 | Delta Upsilon | `delta_upsilon` | Old Gold, Sapphire Blue | `#CFB53B`, `#0F52BA` |
| 19 | Phi Gamma Delta / FIJI | `phi_gamma_delta` | Royal Purple, White | `#4B0082`, `#FFFFFF` |
| 20 | Phi Kappa Psi | `phi_kappa_psi` | Cardinal Red, Hunter Green | `#C41E3A`, `#355E3B` |
| 21 | Phi Kappa Tau | `phi_kappa_tau` | Harvard Red, Old Gold | `#A51C30`, `#CFB53B` |
| 22 | Theta Chi | `theta_chi` | Military Red, White | `#B22222`, `#FFFFFF` |
| 23 | Zeta Beta Tau | `zeta_beta_tau` | Medium Blue, White | `#0000CD`, `#FFFFFF` |
| 24 | Delta Chi | `delta_chi` | Red, Buff | `#C8102E`, `#F0DC82` |
| 25 | Delta Sigma Phi | `delta_sigma_phi` | Nile Green, White | `#29AB87`, `#FFFFFF` |
| 26 | Alpha Sigma Phi | `alpha_sigma_phi` | Cardinal Red, Stone Grey | `#C41E3A`, `#928E85` |
| 27 | Alpha Epsilon Pi | `alpha_epsilon_pi` | Gold, Blue | `#D4AF37`, `#0033A0` |
| 28 | Kappa Alpha Order | `kappa_alpha_order` | Crimson, Old Gold | `#DC143C`, `#CFB53B` |
| 29 | Sigma Pi | `sigma_pi` | Lavender, White, Gold | `#E6E6FA`, `#FFFFFF`, `#D4AF37` |
| 30 | Phi Sigma Kappa | `phi_sigma_kappa` | Cardinal Red, Silver | `#C41E3A`, `#C0C0C0` |

## JSON-style Data

```js
export const fraternityColors = [
  { rank: 1, name: "Tau Kappa Epsilon", key: "tau_kappa_epsilon", officialColors: ["Cherry", "Gray"], hexColors: ["#D2042D", "#808080"] },
  { rank: 2, name: "Kappa Sigma", key: "kappa_sigma", officialColors: ["Scarlet", "White", "Emerald Green"], hexColors: ["#FF2400", "#FFFFFF", "#50C878"] },
  { rank: 3, name: "Sigma Alpha Epsilon", key: "sigma_alpha_epsilon", officialColors: ["Royal Purple", "Old Gold"], hexColors: ["#4B0082", "#CFB53B"] },
  { rank: 4, name: "Sigma Chi", key: "sigma_chi", officialColors: ["Blue", "Old Gold"], hexColors: ["#0033A0", "#CFB53B"] },
  { rank: 5, name: "Sigma Phi Epsilon", key: "sigma_phi_epsilon", officialColors: ["Red", "Purple", "Gold"], hexColors: ["#C8102E", "#4B0082", "#D4AF37"] },
  { rank: 6, name: "Pi Kappa Alpha", key: "pi_kappa_alpha", officialColors: ["Garnet", "Old Gold"], hexColors: ["#782F40", "#CFB53B"] },
  { rank: 7, name: "Lambda Chi Alpha", key: "lambda_chi_alpha", officialColors: ["Purple", "Green", "Yellow"], hexColors: ["#4B0082", "#008000", "#FFD700"] },
  { rank: 8, name: "Pi Kappa Phi", key: "pi_kappa_phi", officialColors: ["White", "Gold"], hexColors: ["#FFFFFF", "#D4AF37"] },
  { rank: 9, name: "Sigma Nu", key: "sigma_nu", officialColors: ["White", "Gold", "Black"], hexColors: ["#FFFFFF", "#D4AF37", "#000000"] },
  { rank: 10, name: "Phi Delta Theta", key: "phi_delta_theta", officialColors: ["Azure", "Argent"], hexColors: ["#007FFF", "#C0C0C0"] },
  { rank: 11, name: "Alpha Phi Alpha", key: "alpha_phi_alpha", officialColors: ["Black", "Gold"], hexColors: ["#000000", "#D4AF37"] },
  { rank: 12, name: "Kappa Alpha Psi", key: "kappa_alpha_psi", officialColors: ["Crimson", "Creme"], hexColors: ["#DC143C", "#FFFDD0"] },
  { rank: 13, name: "Omega Psi Phi", key: "omega_psi_phi", officialColors: ["Royal Purple", "Old Gold"], hexColors: ["#4B0082", "#CFB53B"] },
  { rank: 14, name: "Iota Phi Theta", key: "iota_phi_theta", officialColors: ["Charcoal Brown", "Gilded Gold"], hexColors: ["#3B2F2F", "#D4AF37"] },
  { rank: 15, name: "Alpha Tau Omega", key: "alpha_tau_omega", officialColors: ["Azure Blue", "Old Gold"], hexColors: ["#007FFF", "#CFB53B"] },
  { rank: 16, name: "Beta Theta Pi", key: "beta_theta_pi", officialColors: ["Pink", "Blue"], hexColors: ["#FFC0CB", "#0033A0"] },
  { rank: 17, name: "Delta Tau Delta", key: "delta_tau_delta", officialColors: ["Royal Purple", "White", "Yellow Gold"], hexColors: ["#4B0082", "#FFFFFF", "#FFD700"] },
  { rank: 18, name: "Delta Upsilon", key: "delta_upsilon", officialColors: ["Old Gold", "Sapphire Blue"], hexColors: ["#CFB53B", "#0F52BA"] },
  { rank: 19, name: "Phi Gamma Delta / FIJI", key: "phi_gamma_delta", officialColors: ["Royal Purple", "White"], hexColors: ["#4B0082", "#FFFFFF"] },
  { rank: 20, name: "Phi Kappa Psi", key: "phi_kappa_psi", officialColors: ["Cardinal Red", "Hunter Green"], hexColors: ["#C41E3A", "#355E3B"] },
  { rank: 21, name: "Phi Kappa Tau", key: "phi_kappa_tau", officialColors: ["Harvard Red", "Old Gold"], hexColors: ["#A51C30", "#CFB53B"] },
  { rank: 22, name: "Theta Chi", key: "theta_chi", officialColors: ["Military Red", "White"], hexColors: ["#B22222", "#FFFFFF"] },
  { rank: 23, name: "Zeta Beta Tau", key: "zeta_beta_tau", officialColors: ["Medium Blue", "White"], hexColors: ["#0000CD", "#FFFFFF"] },
  { rank: 24, name: "Delta Chi", key: "delta_chi", officialColors: ["Red", "Buff"], hexColors: ["#C8102E", "#F0DC82"] },
  { rank: 25, name: "Delta Sigma Phi", key: "delta_sigma_phi", officialColors: ["Nile Green", "White"], hexColors: ["#29AB87", "#FFFFFF"] },
  { rank: 26, name: "Alpha Sigma Phi", key: "alpha_sigma_phi", officialColors: ["Cardinal Red", "Stone Grey"], hexColors: ["#C41E3A", "#928E85"] },
  { rank: 27, name: "Alpha Epsilon Pi", key: "alpha_epsilon_pi", officialColors: ["Gold", "Blue"], hexColors: ["#D4AF37", "#0033A0"] },
  { rank: 28, name: "Kappa Alpha Order", key: "kappa_alpha_order", officialColors: ["Crimson", "Old Gold"], hexColors: ["#DC143C", "#CFB53B"] },
  { rank: 29, name: "Sigma Pi", key: "sigma_pi", officialColors: ["Lavender", "White", "Gold"], hexColors: ["#E6E6FA", "#FFFFFF", "#D4AF37"] },
  { rank: 30, name: "Phi Sigma Kappa", key: "phi_sigma_kappa", officialColors: ["Cardinal Red", "Silver"], hexColors: ["#C41E3A", "#C0C0C0"] }
];
```

## Agent Instructions

1. Add this data to the app as the default fraternity color palette.
2. Use `hexColors[0]` as the primary color, `hexColors[1]` as the secondary color, and `hexColors[2]` as an optional accent when present.
3. Keep `officialColors` visible in the data model so we can update exact official brand hex codes later if a fraternity publishes them.
4. Do not claim these are official brand-guide hex values; they are practical web approximations of official fraternity color names.

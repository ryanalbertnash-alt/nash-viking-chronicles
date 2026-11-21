export type NavStep = { at: number; lat: number; lng: number; say: string; road: string; limit: number }
export type NavPlan = { label: string; coords: [number, number][]; steps: NavStep[]; meters: number; seconds: number }

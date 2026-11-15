/**
 * Demo seed data for the "Try demo" one-click experience (Phase 6)
 */
export async function seedDemoHousehold(): Promise<{ householdCode: string; elderEmail: string }> {
  // To be implemented in Phase 6 with pre-populated meds, doses, appointments, and audit history
  return {
    householdCode: 'DEMO1234',
    elderEmail: 'demo-elder@carecircle.local',
  };
}

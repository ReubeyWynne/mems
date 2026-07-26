namespace BearHunt.Models;

// ─── Signal DTOs ──────────────────────────────────────────────

record WaveAssignSignals(int prefId, string wave);

record LeaderInfo(string Username, double K, double RInf, double RCav, double RArc, int RallyCapacity);

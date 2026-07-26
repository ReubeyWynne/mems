namespace BearHunt.Models;

// ─── Signal DTOs ──────────────────────────────────────────────

record PreferenceSignals(string selectedTrap, string? preferredTime, string notes);
record CycleSignals(DateTime date, string trap1Time, string trap2Time);
record WaveAssignSignals(int prefId, string wave);
record RallyLeadToggleSignals(int prefId);
record RemoveSignals();
record JokeSignals(string text);

record LeaderInfo(string Username, double K, double RInf, double RCav, double RArc, int RallyCapacity);

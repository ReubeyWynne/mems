namespace BearHunt.Models;

public class Cycle
{
    public int Id { get; set; }          // always 1 — singleton
    public DateTime StartDate { get; set; }
    public TimeOnly Trap1Time { get; set; }
    public TimeOnly Trap2Time { get; set; }
}

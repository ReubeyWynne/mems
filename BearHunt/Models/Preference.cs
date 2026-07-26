namespace BearHunt.Models;

public class Preference
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string SelectedTrap { get; set; } = "either";
    public TimeOnly? PreferredTime { get; set; }
    public string Notes { get; set; } = "";
    public string? Wave { get; set; }
    public bool IsRallyLead { get; set; }
}

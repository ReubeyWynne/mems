namespace BearHunt.Models;

public class Member
{
    public string Username { get; set; } = "";
    public int Infantry { get; set; }
    public int Cavalry { get; set; }
    public int Archers { get; set; }
    public string RallyLeadHero { get; set; } = "";
    public int WidgetLevel { get; set; }
    public int RallySize { get; set; }
    public int SoloMarchSize { get; set; }
    public int RallyJoinerCap { get; set; }
    public string JoinerHero1 { get; set; } = "";
    public string PreferredBearWindow { get; set; } = "";
    public int? InfantryAtkPct { get; set; }
    public int? InfantryLethalityPct { get; set; }
    public int? CavalryAtkPct { get; set; }
    public int? CavalryLethalityPct { get; set; }
    public int? ArcherAtkPct { get; set; }
    public int? ArcherLethalityPct { get; set; }
    public int MarchCount { get; set; }
    public int TroopTier { get; set; } // display-only in v1; no math effect until TG3+ archer bonus lands
    public string Role { get; set; } = "member";
    public DateTime UpdatedAt { get; set; }
}

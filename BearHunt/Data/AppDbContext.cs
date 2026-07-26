using BearHunt.Models;
using Microsoft.EntityFrameworkCore;

namespace BearHunt.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Member> Members => Set<Member>();
    public DbSet<Cycle> Cycles => Set<Cycle>();
    public DbSet<Joke> Jokes => Set<Joke>();
    public DbSet<Preference> Preferences => Set<Preference>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Member>().HasKey(m => m.Username);


        modelBuilder.Entity<Preference>(p =>
        {
            p.HasKey(p => p.Id);
            p.HasIndex(p => p.Username).IsUnique();
        });
    }
}

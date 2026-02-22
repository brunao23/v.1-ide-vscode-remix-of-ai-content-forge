export default function AgentLoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    </div>
  );
}

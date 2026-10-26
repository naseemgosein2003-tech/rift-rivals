import { test, expect } from "@playwright/test";

const origin = "http://localhost:5173";

test("dodge has early protection and punishable recovery", async ({ page }) => {
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const { Engine, DODGE_IFRAMES, DODGE_COOLDOWN } = await import("/src/game/engine.ts");
    const { DEFAULT_SETTINGS } = await import("/src/game/data.ts");
    const game = new Engine(document.createElement("canvas"), "ronin", { ...DEFAULT_SETTINGS, mode: "local", sound: false }, () => {}, () => {});
    game.destroy(); game.phase = "running";
    const [a,b] = game.fighters;
    a.x = 480; b.x = 1000;
    game.attack(a, "light", "gS");
    game.input(0,"dodge",true); game.update(1/60);
    const blockedCancel = a.dodgeCD === 0 && a.attack?.kind === "light";
    game.input(0,"dodge",false);
    a.attack = null; a.attackCD = 0;
    game.input(0,"dodge",true); game.update(1/60);
    const start = {duration:a.dodgeTime, protection:a.invulnerable, cooldown:a.dodgeCD};
    const earlyBlocked = !game.hit(b,a,16,false,false);
    game.input(0,"dodge",false);
    for(let i=0;i<12;i++){game.hitstop=0;game.update(1/60);}
    const recovery = {duration:a.dodgeTime, protection:a.invulnerable};
    const punished = game.hit(b,a,16,false,false);
    return {blockedCancel,start,earlyBlocked,recovery,punished,damage:a.damage,iframes:DODGE_IFRAMES,cooldown:DODGE_COOLDOWN};
  });
  expect(result.blockedCancel).toBe(true);
  expect(result.start.duration).toBe(0.3);
  expect(result.start.protection).toBe(result.iframes);
  expect(result.start.cooldown).toBe(result.cooldown);
  expect(result.earlyBlocked).toBe(true);
  expect(result.recovery.duration).toBeGreaterThan(0);
  expect(result.recovery.protection).toBe(0);
  expect(result.punished).toBe(true);
  expect(result.damage).toBeGreaterThan(0);
});

test("downward air dodge does not refresh jump or recovery resources", async ({ page }) => {
  await page.goto(origin);
  const result = await page.evaluate(async () => {
    const {Engine}=await import("/src/game/engine.ts");
    const {DEFAULT_SETTINGS}=await import("/src/game/data.ts");
    const game=new Engine(document.createElement("canvas"),"ronin",{...DEFAULT_SETTINGS,mode:"local",sound:false},()=>{},()=>{});
    game.destroy();game.phase="running";
    const f=game.fighters[0];f.x=550;f.y=290;f.grounded=false;f.coyote=0;f.jumps=3;f.recoveryUsed=true;
    game.input(0,"down",true);game.input(0,"dodge",true);game.update(1/60);
    const first={dx:f.dodgeVectorX,dy:f.dodgeVectorY,vy:f.vy,jumps:f.jumps,recovery:f.recoveryUsed,cd:f.dodgeCD};
    game.input(0,"dodge",false);game.update(1/60);
    game.input(0,"dodge",true);game.update(1/60);
    return {first,blocked:f.dodgeCD<first.cd};
  });
  expect(result.first.dx).toBe(0);
  expect(result.first.dy).toBe(1);
  expect(result.first.vy).toBeGreaterThan(400);
  expect(result.first.jumps).toBe(3);
  expect(result.first.recovery).toBe(true);
  expect(result.blocked).toBe(true);
});

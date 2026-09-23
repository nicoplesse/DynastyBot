const numeric = (value, base = null) => {
  if (value == null) return null;
  const percent = String(value).includes('%');
  const number = Number(String(value).replace(/[,%]/g, ''));
  return percent && base != null && Math.abs(base) <= 1 ? number / 100 : number;
};

function groupFor(key) {
  if (key.startsWith('Multiplier.')) return 'Multipliers';
  if (/^(?:Core\.)?(?:.*(?:Speed|Stamina|Turn|Jump|Acceleration|Flight|Swim))/.test(key)) return 'Movement & Stamina';
  if (key.startsWith('Core.')) return 'Core & Survival';
  if (/(?:Damage|Attack|Bite|Claw|Charge|Stomp|Bleed|Venom|Bone|Cooldown|Knockback)/i.test(key)) return 'Combat & Abilities';
  return 'Other Abilities';
}

function exactKey(text, keys) {
  const line = text.toLowerCase();
  const exact = name => keys.includes(name) ? name : null;
  const like = expression => keys.filter(key => expression.test(key));
  if (/combat weight/.test(line)) return exact('Core.CombatWeight');
  if (/health recovery rate|health regen/.test(line)) return exact('Core.HealthRecoveryRate');
  if (/\b(?:max )?health\b/.test(line) && !/heal cooldown|health recovery/.test(line)) return exact('Core.MaxHealth');
  if (/\b(?:base )?armor\b/.test(line) && !/armor piercing/.test(line)) return exact('Core.Armor');
  if (/thirst depletion rate/.test(line)) return exact('Core.ThirstDepletionRate');
  if (/oxygen depletion rate/.test(line)) return exact('Core.OxygenDepletionRate');
  if (/stamina recovery rate/.test(line)) return exact('Core.StaminaRecoveryRate');
  if (/stamina recovery.*trotting/.test(line)) return exact('Multiplier.StaminaRecovery.Trotting');
  if (/bigger stamina pool|max stamina/.test(line)) return exact('Core.MaxStamina');
  if (/turn in place/.test(line) && !/turn radius/.test(line)) return exact('Core.TurnInPlaceRadiusMultiplier');
  if (/turn radius/.test(line) && !/turn in place/.test(line)) return exact('Core.TurnRadiusMultiplier');
  if (/jump force/.test(line)) return exact('Core.JumpForceMultiplier') || like(/(?:^|\.)JumpForceMultiplier$/)[0] || null;
  if (/jump height/.test(line)) return exact('Core.JumpForceMultiplier');
  if (/sprint speed|sprinting speed/.test(line)) return exact('Core.SprintingSpeedMultiplier');
  if (/trot speed/.test(line)) return exact('Core.TrottingSpeedMultiplier');
  if (/movement speed/.test(line)) {
    if (/climb/.test(line)) return exact('Multiplier.MovementSpeedMultiplier.Climbing');
    if (/swim/.test(line)) return exact('Multiplier.MovementSpeedMultiplier.Swimming');
    return exact('Core.MovementSpeedMultiplier');
  }
  if (/spike damage/.test(line)) return exact('Core.SpikeDamageMultiplier');
  if (/knockback traction multiplier/.test(line)) return exact('Core.KnockbackTractionMultiplier');
  if (/falling leg damage/.test(line)) return exact('Core.FallingLegDamage');
  if (/leg heal rate/.test(line)) return exact('Core.LegHealRate');
  if (/bleed heal rate/.test(line)) return exact('Core.BleedingHealRate');
  if (/stamina sprint cost per second|sprint cost per second|sprint stamina cost per second/.test(line)) return exact('StaminaSprintCostPerSecond');
  if (/stamina sprint cost multiplier/.test(line)) return exact('Core.StaminaSprintCostMultiplier');
  if (/fast swim (?:stamina cost|cost per second)|stamina fast swim cost per second/.test(line)) return exact('StaminaFastSwimCostPerSecond');
  if (/fast swim cost multiplier/.test(line)) return exact('Core.StaminaFastSwimCostMultiplier');
  if (/swim (?:stamina cost|cost per second)|stamina swim cost per second/.test(line)) return exact('StaminaSwimgCostPerSecond');
  if (/(?:sprint stamina cost|stamina cost while sprinting|stamina sprint cost|sprint cost)/.test(line)) return exact('StaminaSprintCostPerSecond');
  if (/stamina drain for gliding/.test(line)) return exact('StaminaGlidingCostPerSecond');
  if (/stamina drain for hovering/.test(line)) return exact('StaminaHoveringCostPerSecond');
  if (/stamina drain for normal flight/.test(line)) return exact('StaminaFlyCostPerSecond');
  if (/stamina jump cost/.test(line)) return exact('StaminaJumpCost') || exact('Core.StaminaJumpCostMultiplier');
  if (/jump stamina drain/.test(line)) return exact('StaminaJumpCost');
  if (/swimming stam(?:ina)? drain/.test(line)) return exact('StaminaSwimgCostPerSecond');
  if (/attach stamina drain per second/.test(line)) return exact('AttachStaminaDrainPerSecond');
  if (/clamp carry/.test(line)) return exact('ClampCarryStaminaCostPerSecond');
  if (/grab carry cost/.test(line)) return exact('GrabCarryStaminaCost');
  if (/carry capacity/.test(line)) return exact('Core.CarryCapacity') || exact('CarryCapacity');
  if (/carrion feeder range/.test(line)) return exact('CarrionFeederRange');
  if (/chomp bone break amount/.test(line)) return exact('ChompBoneBreakAmount');
  if (/\b(?:default )?bite damage\b/.test(line) && !/charged|crushing/.test(line)) return exact('BiteDamage');
  if (/claw attack damage/.test(line) && !/charged/.test(line)) return exact('ClawAttackDamage');
  if (/claw bleed amount/.test(line)) return exact('ClawBleedAmount');
  if (/bleed amount from bite attack/.test(line)) return exact('BiteBleedAmount');
  if (/charged claw attack damage/.test(line)) return exact('ClawChargedAttackDamage');
  if (/body slam damage/.test(line)) return exact('BodySlamDamage');
  if (/neck slap damage/.test(line)) return exact('NeckSlapDamage');
  if (/tail damage/.test(line)) return exact('TailAttackDamage') || exact('TailDamage');
  if (/charge damage/.test(line)) return exact('ChargeDamage');
  if (/charge acceleration increase/.test(line)) return exact('ChargeAccelerationIncrease');
  if (/charge cooldown/.test(line)) return exact('ChargeCooldown');
  if (/charge duration/.test(line)) return exact('ChargeDuration');
  if (/kick knockback force/.test(line)) return exact('KickKnockbackForce');
  if (/kick damage/.test(line)) return exact('KickDamage');
  if (/spikes hide bleed amount/.test(line)) return exact('SpikesHideBleed');
  if (/feral instincts piercing damage multiplier/.test(line)) return exact('FeralInstinctsPiercingDamageMultiplierBuff');
  if (/tyrant roar damage multiplier/.test(line)) return exact('TyrantRoarDamageMultiplierBuff');
  if (/stamina drain from carrying a clamped victim/.test(line)) return exact('ClampCarryStaminaCostPerSecond');
  if (/initial stamina cost for clamp/.test(line)) return exact('ClampCost');
  if (/clamp damage/.test(line) && /removed/.test(line)) return exact('ClampDamage');
  if (/crushing bite.s bone break/.test(line)) return exact('CrushingBoneBreakAmount');
  if (/bite cooldown/.test(line) && !/charged|crushing/.test(line)) return exact('BiteCooldown');
  if (/pounce cooldown/.test(line)) return exact('PounceCooldown');
  if (/riptide cooldown/.test(line)) return exact('RiptideCooldown');
  if (/salt sneeze cooldown/.test(line)) return exact('SaltSneezeCooldown');
  if (/tail cooldown/.test(line)) return exact('TailAttackCooldown') || exact('TailCooldown');
  if (/small stomp cooldown/.test(line)) return exact('StompCooldown');
  if (/stomp damage/.test(line) && !/big/.test(line)) return exact('StompDamage');
  if (/spit cooldown/.test(line)) return exact('SpitCooldown');
  if (/buff heal cooldown/.test(line)) return like(/BuffHealCooldown$/i)[0] || null;
  if (/bloodsoaked stamina recovery buff/.test(line)) return exact('BloodsoakedStaminaRecoveryBuff');
  if (/herring cooldown/.test(line)) return like(/Herring.*Cooldown$/i)[0] || null;
  if (/herring duration/.test(line)) return like(/Herring.*Duration$/i)[0] || null;
  if (/herring speed bonus/.test(line)) return like(/Herring.*Speed/i)[0] || null;
  return null;
}

function findKey(change, keys) {
  return exactKey(change.text, keys);
}

function overrideValue(change, base) {
  if (/\bremoved?\b/i.test(change.text)) return { value: 0, method: 'removed' };
  if (/\bdoubled\b/i.test(change.text) && Number.isFinite(base)) return { value: base * 2, method: 'calculated' };
  if (/\bhalved\b/i.test(change.text) && Number.isFinite(base)) return { value: base / 2, method: 'calculated' };
  if (change.current != null && Number.isFinite(numeric(change.current, base))) return { value: numeric(change.current, base), method: 'explicit' };
  const arrow = change.text.match(/\b([\d.]+)\s*>\s*([\d.]+)/);
  if (arrow) return { value: Number(arrow[2]), method: 'explicit' };
  const to = change.text.match(/\b(?:to|set at)\s*:?\s*([\d.]+)\b/i);
  if (to) return { value: Number(to[1]), method: 'explicit' };
  const percent = change.text.match(/(?:by\s*\+?|\+)([\d.]+)\s*%|([\d.]+)\s*%/i);
  if (percent && Number.isFinite(base)) {
    const fraction = Number(percent[1] || percent[2]) / 100;
    const lower = /decreas|reduc|lower|nerf/i.test(change.text);
    return { value: Number((base * (lower ? 1 - fraction : 1 + fraction)).toFixed(6)), method: 'calculated' };
  }
  const plus = change.text.match(/\b(?:increase|increased|upped|boosted)\b[^\n]*?\bby\s*\+?(\d+(?:\.\d+)?)(?![\d.%])/i);
  if (plus && Number.isFinite(base)) return { value: Number((base + Number(plus[1])).toFixed(6)), method: 'calculated' };
  return { value: null, method: 'unquantified' };
}

export function combineStats(dynasty, reference, fetchedAt = null) {
  if (!reference) return { baseline: null, curves: [], unmappedChanges: dynasty.changes.map(change => change.text), warnings: [] };
  const keys = Object.keys(reference.curves);
  const rows = Object.fromEntries(keys.map(key => [key, {
    key, group: groupFor(key), baseValues: reference.curves[key], effectiveValues: [...reference.curves[key]],
    adjustments: [],
  }]));
  const warnings = [];
  const unmappedChanges = [];
  const weight = rows['Core.CombatWeight'];
  if (weight && dynasty.combatWeight != null && dynasty.combatWeight !== weight.baseValues.at(-1)) {
    weight.effectiveValues[4] = dynasty.combatWeight;
    weight.adjustments.push({ text: `Combat Weight: ${dynasty.combatWeight} (Dynasty profile header)`, stage: 4,
      previous: weight.baseValues.at(-1), current: dynasty.combatWeight, method: 'profile-header', mismatch: false });
  }
  for (const change of dynasty.changes) {
    const key = findKey(change, keys);
    if (!key) { unmappedChanges.push(change.text); continue; }
    const stage = /\bhatchling\b/i.test(change.text) ? 0 : 4;
    const row = rows[key];
    const base = row.baseValues[stage] ?? row.baseValues.at(-1);
    const previous = numeric(change.previous, base);
    const mismatch = previous != null && Math.abs(previous - base) > 0.00001;
    if (mismatch) warnings.push(`${key}: reference ${base}, Dynasty change says previous ${previous}.`);
    const result = overrideValue(change, base);
    if (key === 'Core.CombatWeight' && dynasty.combatWeight != null) {
      if (result.value != null && result.value !== dynasty.combatWeight)
        warnings.push(`Combat Weight: Dynasty header ${dynasty.combatWeight} conflicts with change text ${result.value}.`);
    } else {
      row.effectiveValues[stage] = result.value;
    }
    row.adjustments.push({ text: change.text, stage, previous: previous ?? base,
      current: key === 'Core.CombatWeight' && dynasty.combatWeight != null ? dynasty.combatWeight : result.value,
      method: result.method, mismatch });
  }
  return {
    baseline: { title: reference.sourceTitle, url: reference.sourceUrl, type: reference.sourceType,
      updatedAt: reference.sourceUpdatedAt, fetchedAt },
    curves: Object.values(rows),
    unmappedChanges,
    warnings,
  };
}

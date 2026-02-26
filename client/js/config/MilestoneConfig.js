export const MILESTONES = [
    { wave: 10,  label: 'FIRST BOSS DOWN!',  bonusXP: 50,  bonusTokens: 3 },
    { wave: 25,  label: 'QUARTER CENTURY!',   bonusXP: 100, bonusTokens: 5 },
    { wave: 50,  label: 'HALF CENTURY!',      bonusXP: 200, bonusTokens: 10 },
    { wave: 75,  label: 'LEGEND STATUS!',     bonusXP: 350, bonusTokens: 15 },
    { wave: 100, label: 'CENTURION!!',        bonusXP: 500, bonusTokens: 25 },
];

export function getMilestoneForWave(wave) {
    return MILESTONES.find(m => m.wave === wave) || null;
}

export function isMiniMilestone(wave) {
    return wave > 0 && wave % 10 === 0;
}

#!/usr/bin/env node
/*
 * build-cards.js — Card set materializer
 * ========================================
 * Loads cards.json, applies the SAME transform logic the engine uses
 * (transformCards, embedded below as the single source of truth), and writes:
 *
 *   card_database.json             — the live build (engine/simulator input)
 *   card_database.master.json      — authoritative reference (frozen; used in checkpoints)
 *   card_database.backup.json      — backup of the master
 *   card_database.tentative.json   — editable working copy (edit constantly,
 *                                    promote to master only when confident)
 *
 * Also regenerates shared/card-schema.js from schema_definitions.json and
 * validates the build against that schema.
 *
 * Usage:
 *   node build-cards.js build     (default) rebuild card_database.json from cards.json
 *   node build-cards.js init      (re)seed master/backup/tentative from the current build
 *   node build-cards.js promote   copy tentative -> master (old master -> backup)
 *   node build-cards.js verify    compare live build against master (report drift)
 *
 * NOTE: the embedded transformCards() must stay byte-for-byte identical to the
 * copy in simulate.js (and game.js). It is the ONLY source that generates data.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ---------------------------------------------------------------------------
// transformCards — exact copy from simulate.js (which mirrors game.js)
// ---------------------------------------------------------------------------
function transformCards(cards) {
    const a = (n, t, e, v, o) => ({name:n,trigger:t,effect:e,value:v==null?0:v,oncePerTurn:!!(o&&o.once),activationCost:(o&&o.cost)||null,...((o&&o.tp!=null)?{tokenPower:o.tp,tokenToughness:o.tt,tokenName:o.tn}:{})});
  const getCost = (c) => typeof c === 'number' ? c : ((c && (c.generic || 0)) + (c && c.color ? 1 : 0));

  const newCards = [
    { id:341,name:"Inferno Sovereign",type:"Champion",cost:7,power:6,toughness:5,providesMana:null,color:"Crimson",rarity:"Mythic",abilities:[{name:"Volcanic Wrath",trigger:"enter_battlefield",effect:"damage_all_enemies",value:2,oncePerTurn:false,activationCost:null},{name:"Flame Touch",trigger:"tap",effect:"damage_any_target",value:1,oncePerTurn:false,activationCost:null},{name:"Swiftstrike",trigger:"static",effect:"haste",value:0,oncePerTurn:false,activationCost:null},{name:"Quickdraw",trigger:"static",effect:"first_strike",value:0,oncePerTurn:false,activationCost:null}]},
    { id:342,name:"Emberheart Titan",type:"Champion",cost:6,power:5,toughness:4,providesMana:null,color:"Crimson",rarity:"Mythic",abilities:[{name:"Sacrificial Flame",trigger:"once_per_turn",effect:"sacrifice_then_damage",value:3,oncePerTurn:true,activationCost:null},{name:"Swiftstrike",trigger:"static",effect:"haste",value:0,oncePerTurn:false,activationCost:null}]},
    { id:343,name:"Worldtree Ancient",type:"Champion",cost:7,power:5,toughness:8,providesMana:null,color:"Sunforged",rarity:"Mythic",abilities:[{name:"Worldsprout",trigger:"enter_battlefield",effect:"create_token",value:2,tokenPower:2,tokenToughness:2,tokenName:"Saproling",oncePerTurn:false,activationCost:null},{name:"Keen Eye",trigger:"static",effect:"vigilance",value:0,oncePerTurn:false,activationCost:null},{name:"Overrun",trigger:"static",effect:"trample",value:0,oncePerTurn:false,activationCost:null}]},
    { id:344,name:"Verdant Sovereign",type:"Champion",cost:6,power:6,toughness:6,providesMana:null,color:"Sunforged",rarity:"Mythic",abilities:[{name:"Overrun",trigger:"static",effect:"trample",value:0,oncePerTurn:false,activationCost:null},{name:"Overgrowth",trigger:"attacks",effect:"create_token",value:1,tokenPower:1,tokenToughness:1,tokenName:"Saproling",oncePerTurn:false,activationCost:null},{name:"Keen Eye",trigger:"static",effect:"vigilance",value:0,oncePerTurn:false,activationCost:null}]},
    { id:345,name:"Lich Lord",type:"Champion",cost:7,power:4,toughness:6,providesMana:null,color:"Lantern",rarity:"Mythic",abilities:[{name:"Undead Recall",trigger:"enter_battlefield",effect:"return_from_graveyard",value:2,oncePerTurn:false,activationCost:null},{name:"Soul Tap",trigger:"paid_mana",effect:"drain_life",value:1,oncePerTurn:false,activationCost:2},{name:"Deathshroud",trigger:"static",effect:"deathtouch",value:0,oncePerTurn:false,activationCost:null},{name:"Siphon",trigger:"static",effect:"lifelink",value:0,oncePerTurn:false,activationCost:null}]},
    { id:346,name:"Plague Sovereign",type:"Champion",cost:6,power:5,toughness:5,providesMana:null,color:"Lantern",rarity:"Mythic",abilities:[{name:"Plagueburst",trigger:"dies",effect:"destroy_all_enemies",value:0,oncePerTurn:false,activationCost:null},{name:"Pestilence Aura",trigger:"end_of_turn",effect:"drain_all_opponents",value:2,oncePerTurn:false,activationCost:null},{name:"Deathshroud",trigger:"static",effect:"deathtouch",value:0,oncePerTurn:false,activationCost:null}]},
    { id:347,name:"Leviathan of the Deep",type:"Champion",cost:7,power:6,toughness:6,providesMana:null,color:"Gilded",rarity:"Mythic",abilities:[{name:"Tidal Surge",trigger:"enter_battlefield",effect:"bounce_enemies",value:2,oncePerTurn:false,activationCost:null},{name:"Flying",trigger:"static",effect:"flying",value:0,oncePerTurn:false,activationCost:null},{name:"Intimidate",trigger:"static",effect:"menace",value:0,oncePerTurn:false,activationCost:null}]},
    { id:348,name:"Tidal Sovereign",type:"Champion",cost:6,power:4,toughness:5,providesMana:null,color:"Gilded",rarity:"Mythic",abilities:[{name:"Riptide Command",trigger:"attacks",effect:"tap_enemy_champion",value:1,oncePerTurn:false,activationCost:null},{name:"Dismissal Wave",trigger:"paid_mana",effect:"bounce_champion",value:1,oncePerTurn:false,activationCost:1},{name:"Flying",trigger:"static",effect:"flying",value:0,oncePerTurn:false,activationCost:null},{name:"Intimidate",trigger:"static",effect:"menace",value:0,oncePerTurn:false,activationCost:null}]},
    { id:349,name:"Magma Vent",type:"Spell",cost:3,power:null,toughness:null,providesMana:null,color:"Crimson",rarity:"Uncommon",abilities:[{name:"Magma Vent",trigger:"on_cast",effect:"ramp_search_land",value:1,oncePerTurn:false,activationCost:null}]},
      { id:350,name:"Obsidian Forge",type:"Relic",cost:4,power:null,toughness:null,providesMana:null,color:"Crimson",rarity:"Rare",abilities:[{name:"Obsidian Forge",trigger:"end_of_turn",effect:"ramp_extra_land",value:1,oncePerTurn:false,activationCost:null}]},
    { id:351,name:"Grave Tithe",type:"Spell",cost:2,power:null,toughness:null,providesMana:null,color:"Lantern",rarity:"Uncommon",abilities:[{name:"Grave Tithe",trigger:"on_cast",effect:"ramp_search_land",value:1,oncePerTurn:false,activationCost:null}]},
    { id:352,name:"Tidal Pool",type:"Spell",cost:2,power:null,toughness:null,providesMana:null,color:"Gilded",rarity:"Uncommon",abilities:[{name:"Tidal Pool",trigger:"on_cast",effect:"ramp_search_land",value:1,oncePerTurn:false,activationCost:null}]},
    { id:353,name:"Merfolk Cartographer",type:"Champion",cost:2,power:1,toughness:2,providesMana:null,color:"Gilded",rarity:"Uncommon",abilities:[{name:"Chart Depths",trigger:"enter_battlefield",effect:"ramp_search_land",value:1,oncePerTurn:false,activationCost:null}]},
    { id:355,name:"Decree of Embers",type:"Decree",cost:3,power:null,toughness:null,providesMana:null,color:"Crimson",rarity:"Uncommon",abilities:[{name:"Decree of Embers",trigger:"on_cast",effect:"purge_weakest",value:0,oncePerTurn:false,activationCost:null}]},
    { id:356,name:"Decree of Foresight",type:"Decree",cost:2,power:null,toughness:null,providesMana:null,color:"Gilded",rarity:"Uncommon",abilities:[{name:"Decree of Foresight",trigger:"on_cast",effect:"scry_2",value:2,oncePerTurn:false,activationCost:null}]},
    { id:357,name:"Decree of Renewal",type:"Decree",cost:3,power:null,toughness:null,providesMana:null,color:"Sunforged",rarity:"Uncommon",abilities:[{name:"Decree of Renewal",trigger:"on_cast",effect:"ready_two_champions",value:1,oncePerTurn:false,activationCost:null}]},
    { id:358,name:"Decree of Night",type:"Decree",cost:3,power:null,toughness:null,providesMana:null,color:"Lantern",rarity:"Uncommon",abilities:[{name:"Decree of Night",trigger:"on_cast",effect:"next_card_costs_less",value:2,oncePerTurn:false,activationCost:null},{name:"Whisper of Dread",trigger:"on_cast",effect:"discard_opponent",value:1,oncePerTurn:false,activationCost:null}]},
    { id:359,name:"Arcane Purge",type:"Spell",cost:2,power:null,toughness:null,providesMana:null,color:"Colorless",rarity:"Uncommon",abilities:[{name:"Arcane Purge",trigger:"on_cast",effect:"purge_target",value:0,oncePerTurn:false,activationCost:null}]},
    { id:360,name:"Reveal the Veil",type:"Instant",cost:1,power:null,toughness:null,providesMana:null,color:"Gilded",rarity:"Common",abilities:[{name:"Reveal the Veil",trigger:"on_cast",effect:"reveal_hidden",value:0,oncePerTurn:false,activationCost:null}]},
    { id:361,name:"Tactical Rest",type:"Instant",cost:2,power:null,toughness:null,providesMana:null,color:"Sunforged",rarity:"Common",abilities:[{name:"Tactical Rest",trigger:"on_cast",effect:"ready_all_champions",value:0,oncePerTurn:false,activationCost:null}]},
    { id:362,name:"Echoing Ward",type:"Instant",cost:2,power:null,toughness:null,providesMana:null,color:"Gilded",rarity:"Uncommon",abilities:[{name:"Echoing Ward",trigger:"on_cast",effect:"next_opponent_card_costs_more",value:2,oncePerTurn:false,activationCost:null}]},
    { id:363,name:"Shroud-Bound Noble",type:"Champion",cost:3,power:3,toughness:3,providesMana:null,color:"Lantern",rarity:"Uncommon",abilities:["Recall 1"]},
    { id:364,name:"Ominous Ghoul",type:"Champion",cost:2,power:2,toughness:2,providesMana:null,color:"Lantern",rarity:"Common",abilities:["Ominous"]},
    { id:365,name:"Booby-Trapped Treasure",type:"Omen",cost:2,power:null,toughness:null,providesMana:null,color:"Crimson",rarity:"Common",flipTrigger:"ON_OPPONENT_SPELL",abilities:[a("Booby Trap","ON_OPPONENT_SPELL","damage_any_target",3)]},
    { id:366,name:"Igneous Berserker",type:"Champion",cost:3,power:3,toughness:2,providesMana:null,color:"Crimson",rarity:"Uncommon",flipTrigger:"ON_COMBAT_DAMAGE",flipCost:{selfDamage:2},abilities:["Ominous",a("Wild Rampage","ON_COMBAT_DAMAGE","pump_self_stats",2)]},
    { id:367,name:"Dazzling Reflective Barrier",type:"Omen",cost:3,power:null,toughness:null,providesMana:null,color:"Sunforged",rarity:"Common",flipTrigger:"ON_COMBAT_DAMAGE",abilities:[a("Mirrorstrike","ON_COMBAT_DAMAGE","tap_enemy_champion",1),a("Polished Guard","ON_COMBAT_DAMAGE","ready_champion",1)]},
    { id:368,name:"Sol-Guard Aegis",type:"Champion",cost:3,power:1,toughness:5,providesMana:null,color:"Sunforged",rarity:"Rare",flipTrigger:"ON_COMBAT_DAMAGE",flipCost:{tapFriendly:1},abilities:["Ominous",a("Radiant Bastion","ON_COMBAT_DAMAGE","reduce_combat_damage_all",1)]},
    { id:369,name:"Grave-Gasp Ambush",type:"Omen",cost:2,power:null,toughness:null,providesMana:null,color:"Lantern",rarity:"Common",flipTrigger:"ON_ALLY_DIES",abilities:[a("Grave-Gasp","ON_ALLY_DIES","purge_weakest",1),a("Feast on Death","ON_ALLY_DIES","drain_life",2)]},
    { id:370,name:"Grave-Binder Korath",type:"Champion",cost:3,power:2,toughness:3,providesMana:null,color:"Lantern",rarity:"Rare",flipTrigger:"ON_ALLY_DIES",flipCost:{sacrificeChampion:1},abilities:["Ominous",a("Bind the Fallen","ON_ALLY_DIES","return_from_graveyard",1)]},
    { id:371,name:"Grand Heist Substitution",type:"Omen",cost:3,power:null,toughness:null,providesMana:null,color:"Gilded",rarity:"Uncommon",flipTrigger:"ON_OPPONENT_SPELL",abilities:[a("Grand Heist","ON_OPPONENT_SPELL","swap_champion",1)]},
    { id:372,name:"Clockwork Impostor",type:"Champion",cost:2,power:2,toughness:2,providesMana:null,color:"Gilded",rarity:"Uncommon",flipTrigger:"END_OF_TURN",flipCost:{bounceFriendlyLand:1},abilities:["Ominous",a("Assumed Identity","END_OF_TURN","next_card_costs_less",2)]},
    { id:373,name:"Rogue's Loaded Deck",type:"Omen",cost:2,power:null,toughness:null,providesMana:null,color:"Colorless",rarity:"Common",flipTrigger:"START_OF_TURN",abilities:[a("Loaded Deck","START_OF_TURN","opponent_chooses_purge",1)]},
    { id:374,name:"Chronos Paradigm Shift",type:"Omen",cost:4,power:null,toughness:null,providesMana:null,color:"Colorless",rarity:"Mythic",flipTrigger:"END_OF_TURN",abilities:[a("Paradigm Shift","END_OF_TURN","invert_stats_all",1)]},
    { id:485,name:"Zealot Vanguard",type:"Champion",cost:2,power:1,toughness:4,providesMana:null,color:"Zealot",rarity:"Common",abilities:["Guard","Bastion"]},
    { id:486,name:"Banner-Bearer of the Faith",type:"Champion",cost:3,power:2,toughness:3,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Holy Rally","trigger":"attacks","effect":"buff_all_allies","value":1,"oncePerTurn":true,"activationCost":null}]},
    { id:487,name:"Pilgrim of the Blade",type:"Champion",cost:1,power:2,toughness:1,providesMana:null,color:"Zealot",rarity:"Common",abilities:["Swiftstrike"]},
    { id:488,name:"Divine Fury",type:"Spell",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Smite Unworthy","trigger":"on_cast","effect":"damage_any_target","value":3,"oncePerTurn":false,"activationCost":null}]},
    { id:489,name:"Censor",type:"Champion",cost:4,power:3,toughness:4,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Suppress Heresy","trigger":"enter_battlefield","effect":"tap_enemy_champion","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:490,name:"Rallying Cry",type:"Instant",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Fervent Charge","trigger":"on_cast","effect":"buff_all_allies","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:491,name:"Inquisitor Adept",type:"Champion",cost:2,power:2,toughness:2,providesMana:null,color:"Zealot",rarity:"Common",abilities:["Siphon",{"name":"Zealot's Grace","trigger":"on_gain_life","effect":"pump_self_stats","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:492,name:"Reliquary of Oaths",type:"Relic",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Blessed Offering","trigger":"on_ally_dies","effect":"gain_life","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:493,name:"War Priest",type:"Champion",cost:3,power:3,toughness:3,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Smite on Strike","trigger":"attacks","effect":"damage_random_enemy","value":2,"oncePerTurn":true,"activationCost":null}]},
    { id:494,name:"Edict of Purity",type:"Decree",cost:4,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Cleanse the Impure","trigger":"on_cast","effect":"purge_weakest","value":null,"oncePerTurn":false,"activationCost":null}]},
    { id:495,name:"Zealot Horseman",type:"Champion",cost:4,power:4,toughness:3,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:["Overrun","Quickdraw"]},
    { id:496,name:"Martyr of the Crusade",type:"Champion",cost:3,power:2,toughness:2,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Sacred Vengeance","trigger":"dies","effect":"damage_all_enemies","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:497,name:"Shield of Devotion",type:"Instant",cost:1,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Aegis of Light","trigger":"on_cast","effect":"reduce_combat_damage_all","value":3,"oncePerTurn":false,"activationCost":null}]},
    { id:498,name:"Crusader of the Host",type:"Champion",cost:5,power:4,toughness:5,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:["Guard",{"name":"Vanguard Push","trigger":"attacks","effect":"ready_champion","value":1,"oncePerTurn":true,"activationCost":null}]},
    { id:499,name:"Grand Inquisition",type:"Decree",cost:5,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Absolute Judgment","trigger":"on_cast","effect":"opponent_chooses_purge","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:500,name:"Saint's Blade",type:"Relic",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Empower the Righteous","trigger":"static","effect":"buff_all_allies","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:501,name:"Archon of the Faith",type:"Champion",cost:6,power:5,toughness:6,providesMana:null,color:"Zealot",rarity:"Rare",abilities:["Bastion","Siphon",{"name":"Aura of Sanctity","trigger":"end_of_turn","effect":"gain_life","value":3,"oncePerTurn":true,"activationCost":null}]},
    { id:503,name:"Paladin of the Order",type:"Champion",cost:4,power:3,toughness:5,providesMana:null,color:"Zealot",rarity:"Rare",abilities:["Guard",{"name":"Righteous Smite","trigger":"attacks","effect":"drain_life","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:504,name:"Purifying Flame",type:"Spell",cost:6,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Scour the Unholy","trigger":"on_cast","effect":"destroy_all_enemies","value":null,"oncePerTurn":false,"activationCost":null}]},
    { id:505,name:"High Priestess",type:"Champion",cost:5,power:2,toughness:6,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Radiant Blessing","trigger":"on_gain_life","effect":"buff_all_allies","value":1,"oncePerTurn":false,"activationCost":null},{"name":"Sanctuary","trigger":"end_of_turn","effect":"gain_life","value":2,"oncePerTurn":true,"activationCost":null}]},
    { id:506,name:"Cathedral of Zeal",type:"Domain",cost:4,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Hallowed Ground","trigger":"on_champion_played","effect":"gain_life","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:507,name:"Saint-General",type:"Champion",cost:6,power:6,toughness:5,providesMana:null,color:"Zealot",rarity:"Legendary",abilities:["Keen Eye",{"name":"Crusader's Command","trigger":"enter_battlefield","effect":"ready_all_champions","value":null,"oncePerTurn":false,"activationCost":null},{"name":"Inspirational Advance","trigger":"attacks","effect":"buff_all_allies","value":2,"oncePerTurn":true,"activationCost":null}]},
    { id:508,name:"Avatar of the Flame",type:"Champion",cost:8,power:8,toughness:8,providesMana:null,color:"Zealot",rarity:"Mythic",abilities:["Overrun","Deathshroud",{"name":"Wrath of the Heavens","trigger":"enter_battlefield","effect":"damage_all_enemies","value":4,"oncePerTurn":false,"activationCost":null},{"name":"Holy Desolation","trigger":"attacks","effect":"purge_weakest","value":null,"oncePerTurn":true,"activationCost":null}]},
    { id:509,name:"Penitent Initiate",type:"Champion",cost:1,power:1,toughness:2,providesMana:null,color:"Zealot",rarity:"Common",abilities:["Swiftstrike"]},
    { id:510,name:"Censer Guard",type:"Champion",cost:2,power:2,toughness:2,providesMana:null,color:"Zealot",rarity:"Common",abilities:["Guard"]},
    { id:511,name:"Sun-Touched Zealot",type:"Champion",cost:2,power:2,toughness:1,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Righteous Spark","trigger":"attacks","effect":"pump_self_stats","value":1,"oncePerTurn":true,"activationCost":null}]},
    { id:512,name:"Relic Bearer",type:"Champion",cost:3,power:2,toughness:3,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Devout Recovery","trigger":"dies","effect":"gain_life","value":3,"oncePerTurn":false,"activationCost":null}]},
    { id:513,name:"Masked Sentinel",type:"Champion",cost:3,power:3,toughness:2,providesMana:null,color:"Zealot",rarity:"Common",abilities:["Bastion"]},
    { id:514,name:"Flame-Bound Ascetic",type:"Champion",cost:3,power:2,toughness:2,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:["Siphon",{"name":"Zealous Resolve","trigger":"on_gain_life","effect":"pump_self_stats","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:515,name:"Temple Justiciar",type:"Champion",cost:4,power:3,toughness:4,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:["Keen Eye",{"name":"Inquisitor's Strike","trigger":"attacks","effect":"damage_random_enemy","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:516,name:"Dawn Crusader",type:"Champion",cost:4,power:4,toughness:3,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:["Overrun"]},
    { id:517,name:"High Standard-Bearer",type:"Champion",cost:5,power:3,toughness:5,providesMana:null,color:"Zealot",rarity:"Rare",abilities:["Guard",{"name":"Aura of Devotion","trigger":"attacks","effect":"buff_all_allies","value":1,"oncePerTurn":true,"activationCost":null}]},
    { id:518,name:"Righteous Arbiter",type:"Champion",cost:5,power:4,toughness:4,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Divine Judgment","trigger":"enter_battlefield","effect":"purge_weakest","value":null,"oncePerTurn":false,"activationCost":null}]},
    { id:519,name:"Grand Executioner of Faith",type:"Champion",cost:6,power:5,toughness:5,providesMana:null,color:"Zealot",rarity:"Rare",abilities:["Intimidate",{"name":"Smite the Unworthy","trigger":"attacks","effect":"damage_any_target","value":3,"oncePerTurn":true,"activationCost":null}]},
    { id:520,name:"Incense Censer of Purity",type:"Relic",cost:1,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Scent of Devotion","trigger":"end_of_turn","effect":"gain_life","value":1,"oncePerTurn":true,"activationCost":null}]},
    { id:521,name:"Golden Altar Cloth",type:"Relic",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Holy Fortitude","trigger":"static","effect":"buff_ally_toughness","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:522,name:"Tome of Sacred Vows",type:"Relic",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Inspiration of Truth","trigger":"on_gain_life","effect":"scry_1","value":null,"oncePerTurn":false,"activationCost":null}]},
    { id:523,name:"Candle of the Eternal Vigil",type:"Relic",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Unwavering Light","trigger":"on_champion_played","effect":"gain_life","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:524,name:"Vessel of Radiant Grace",type:"Relic",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Amplified Healing","trigger":"static","effect":"drain_heal_extra","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:525,name:"War Banner of the Crusade",type:"Relic",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Crusader's Might","trigger":"static","effect":"buff_all_allies","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:526,name:"Scourge of the Impure",type:"Relic",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Purifying Retribution","trigger":"on_ally_dies","effect":"damage_random_enemy","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:527,name:"Shrine of the First Martyr",type:"Relic",cost:4,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Martyr's Return","trigger":"on_ally_dies","effect":"gain_life","value":3,"oncePerTurn":false,"activationCost":null}]},
    { id:528,name:"Solar Monstrance",type:"Relic",cost:4,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Blinding Radiance","trigger":"end_of_turn","effect":"damage_all_enemies","value":1,"oncePerTurn":true,"activationCost":null}]},
    { id:529,name:"Reliquary of the Divine Sun",type:"Relic",cost:5,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Resurrection of Saints","trigger":"paid_mana","effect":"return_from_graveyard","value":1,"oncePerTurn":true,"activationCost":4}]},
    { id:530,name:"Holy Smite",type:"Spell",cost:1,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Smite Target","trigger":"on_cast","effect":"damage_any_target","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:531,name:"Blessing of Devotion",type:"Spell",cost:1,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Sacred Healing","trigger":"on_cast","effect":"gain_life","value":4,"oncePerTurn":false,"activationCost":null}]},
    { id:532,name:"Radiant Bolt",type:"Spell",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Light Beam","trigger":"on_cast","effect":"drain_life","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:533,name:"Purge the Unbeliever",type:"Spell",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Purging Fire","trigger":"on_cast","effect":"purge_weakest","value":null,"oncePerTurn":false,"activationCost":null}]},
    { id:534,name:"Sacred Dawn",type:"Spell",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Divine Light","trigger":"on_cast","effect":"draw_cards","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:535,name:"Pillar of Light",type:"Spell",cost:4,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Searing Column","trigger":"on_cast","effect":"damage_any_target","value":5,"oncePerTurn":false,"activationCost":null}]},
    { id:536,name:"Wrath of the Crusade",type:"Spell",cost:5,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Cleansing Storm","trigger":"on_cast","effect":"damage_all_enemies","value":3,"oncePerTurn":false,"activationCost":null}]},
    { id:537,name:"Divine Intervention",type:"Spell",cost:5,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Miraculous Favor","trigger":"on_cast","effect":"return_from_graveyard","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:538,name:"Final Consecration",type:"Spell",cost:7,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Total Annihilation","trigger":"on_cast","effect":"purge_all_enemies","value":null,"oncePerTurn":false,"activationCost":null}]},
    { id:539,name:"Flash of Radiance",type:"Instant",cost:1,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Blinding Strike","trigger":"on_cast","effect":"stat_change_target","attackDelta":-2,"oncePerTurn":false,"activationCost":null}]},
    { id:540,name:"Righteous Aegis",type:"Instant",cost:1,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Shielding Light","trigger":"on_cast","effect":"stat_change_target","attackDelta":0,"lifeDelta":3,"oncePerTurn":false,"activationCost":null}]},
    { id:541,name:"Zealous Parry",type:"Instant",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Defensive Burst","trigger":"on_cast","effect":"reduce_combat_damage_all","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:542,name:"Smite the Shadow",type:"Instant",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Instant Purge","trigger":"on_cast","effect":"destroy_omen","value":null,"oncePerTurn":false,"activationCost":null}]},
    { id:543,name:"Sunburst",type:"Instant",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Blinding Flash","trigger":"on_cast","effect":"tap_enemy_champion","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:544,name:"Holy Rebuke",type:"Instant",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Retaliatory Drain","trigger":"on_cast","effect":"drain_life","value":3,"oncePerTurn":false,"activationCost":null}]},
    { id:545,name:"Call to the Faithful",type:"Instant",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Instant Rally","trigger":"on_cast","effect":"ready_champion","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:546,name:"Martyr's Sacrifice",type:"Instant",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Sacrifice for Radiance","trigger":"on_cast","effect":"sacrifice_then_damage","value":4,"oncePerTurn":false,"activationCost":null}]},
    { id:547,name:"Sanctified Barrier",type:"Instant",cost:4,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Total Ward","trigger":"on_cast","effect":"reduce_combat_damage_all","value":5,"oncePerTurn":false,"activationCost":null}]},
    { id:548,name:"Edict of Zeal",type:"Decree",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Common",abilities:[{"name":"Proclamation of Faith","trigger":"on_cast","effect":"buff_all_allies","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:549,name:"Edict of Consecration",type:"Decree",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Sanctify Earth","trigger":"on_cast","effect":"gain_life","value":5,"oncePerTurn":false,"activationCost":null}]},
    { id:550,name:"Decree of Excommunication",type:"Decree",cost:4,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:[{"name":"Banishment","trigger":"on_cast","effect":"purge_target","value":null,"oncePerTurn":false,"activationCost":null}]},
    { id:551,name:"Decree of Holy War",type:"Decree",cost:5,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Mobilize the Faithful","trigger":"on_cast","effect":"ready_all_champions","value":null,"oncePerTurn":false,"activationCost":null}]},
    { id:552,name:"Edict of Retribution",type:"Decree",cost:6,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Severe Judgment","trigger":"on_cast","effect":"opponent_chooses_purge","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:553,name:"Omen of the Burning Seal",type:"Omen",cost:2,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Uncommon",flipTrigger:"ON_COMBAT_DAMAGE",faceDownCost:{"generic":2},abilities:[{"name":"Searing Rebuttal","trigger":"ON_COMBAT_DAMAGE","effect":"damage_any_target","value":2,"oncePerTurn":false,"activationCost":null}]},
    { id:554,name:"Omen of Martyrdom",type:"Omen",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",flipTrigger:"ON_ALLY_DIES",faceDownCost:{"generic":2},abilities:[{"name":"Ascension Light","trigger":"ON_ALLY_DIES","effect":"omen_return_ally_with_1_life","value":null,"oncePerTurn":false,"activationCost":null}]},
    { id:555,name:"Cathedral of the Sun",type:"Domain",cost:3,power:null,toughness:null,providesMana:null,color:"Zealot",rarity:"Rare",abilities:[{"name":"Holy Citadel","trigger":"on_gain_life","effect":"buff_all_allies","value":1,"oncePerTurn":false,"activationCost":null}]},
    { id:556,name:"Zealot Sanctuary",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:557,name:"Zealot Citadel",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:558,name:"Zealot Shrine",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:559,name:"Zealot Cathedral",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:560,name:"Zealot Temple",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:561,name:"Zealot Monastery",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:562,name:"Zealot Abbey",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:563,name:"Zealot Chapel",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:564,name:"Zealot Basilicas",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:565,name:"Zealot Spire",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:566,name:"Zealot Sanctum",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:567,name:"Zealot Cloister",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:568,name:"Zealot Reliquary",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:569,name:"Zealot Baptistery",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:570,name:"Zealot Convent",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:571,name:"Zealot Hermitage",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:572,name:"Zealot Chantry",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:573,name:"Zealot Priory",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:574,name:"Zealot Oratory",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:575,name:"Zealot Tabernacle",type:"Land",cost:0,power:null,toughness:null,providesMana:1,color:"Zealot",rarity:"Common",abilities:[]},
    { id:576,name:"Zealot Initiate",type:"Champion",cost:1,power:2,toughness:1,providesMana:null,color:"Zealot",rarity:"Common",abilities:["Swiftstrike"]},
    { id:577,name:"Temple Defender",type:"Champion",cost:2,power:1,toughness:3,providesMana:null,color:"Zealot",rarity:"Common",abilities:["Guard"]},
    { id:578,name:"Ascetic Crusader",type:"Champion",cost:3,power:3,toughness:2,providesMana:null,color:"Zealot",rarity:"Common",abilities:["Siphon"]},
    { id:579,name:"Sacred Paladin",type:"Champion",cost:4,power:3,toughness:4,providesMana:null,color:"Zealot",rarity:"Uncommon",abilities:["Bastion","Guard"]},
    { id:580,name:"High Inquisitor Vael",type:"Champion",cost:5,power:4,toughness:5,providesMana:null,color:"Zealot",rarity:"Legendary",abilities:["Keen Eye",{"name":"Purge the Faithless","trigger":"enter_battlefield","effect":"purge_target","value":null,"oncePerTurn":false,"activationCost":null},{"name":"Inquisitorial Wrath","trigger":"attacks","effect":"damage_any_target","value":2,"oncePerTurn":true,"activationCost":null}]},
    { id:581,name:"Aurelia, Archangel of Zeal",type:"Champion",cost:7,power:7,toughness:7,providesMana:null,color:"Zealot",rarity:"Mythic",abilities:["Flying","Siphon","Overrun",{"name":"Divine Cleansing","trigger":"enter_battlefield","effect":"purge_all_enemies","value":null,"oncePerTurn":false,"activationCost":null},{"name":"Blessing of the Host","trigger":"attacks","effect":"buff_all_allies","value":2,"oncePerTurn":true,"activationCost":null}]}
  ];
  cards.push(...newCards);

  const TRIM_IDS = new Set([1009,1006,1003,1010,1004,1005,1007,1008,1002,26,32,1001,24,25,34,1052,1056,1058,1051,1055,1054,1057,1049,1050,1053,1028,1031,1033,1029,1027,1030,1025,1034,110,102,103,1026,1078,1081,1077,1080,1073,1082,1074,1079,1075,141,155,142,154,1106,1102,1100,1098,1099,486,512,492,490,548,520,531,489,488,530,491,511,513,532,118,237,37,202,206,235,1064,244,248,1039,120,216,148,266,146,1111,197,276,274,188,227,272,277,226,271,327,332,195,525,549,500]);
  cards = cards.filter(c => !TRIM_IDS.has(c.id));

  const rarityOverride = {31:'Rare', 33:'Rare', 35:'Common', 36:'Common', 38:'Common', 39:'Common', 62:'Rare', 70:'Mythic', 71:'Mythic', 75:'Common', 76:'Common', 79:'Common', 80:'Common', 104:'Rare', 105:'Mythic', 107:'Mythic', 118:'Common', 119:'Common', 143:'Rare', 151:'Mythic', 152:'Mythic', 158:'Common', 159:'Common', 163:'Rare', 165:'Mythic', 167:'Mythic', 171:'Mythic', 185:'Common', 186:'Common', 187:'Common', 189:'Common', 190:'Common', 191:'Common', 192:'Common', 193:'Common', 194:'Common', 196:'Common', 198:'Common', 201:'Common', 203:'Common', 204:'Common', 207:'Common', 208:'Common', 209:'Common', 210:'Common', 212:'Common', 213:'Common', 215:'Common', 217:'Common', 218:'Common', 219:'Common', 220:'Common', 221:'Common', 223:'Common', 225:'Common', 228:'Common', 229:'Common', 230:'Common', 231:'Common', 343:'Mythic', 366:'Rare', 501:'Mythic', 503:'Rare', 504:'Rare', 505:'Rare', 506:'Uncommon', 508:'Mythic', 517:'Rare', 518:'Rare', 519:'Mythic', 527:'Uncommon', 528:'Uncommon', 529:'Rare', 536:'Uncommon', 537:'Rare', 538:'Rare', 546:'Uncommon', 547:'Uncommon', 551:'Uncommon', 552:'Uncommon', 554:'Uncommon', 555:'Uncommon', 581:'Mythic', 1021:'Mythic', 1022:'Mythic'};

  const legendaryChampionIds = new Set([354,64,67,72,111,112,115,144,147,157,166,181,200]);
  const legendaryKit = {
    354:[a('Swiftstrike','static','haste'),a('Molten Fury','enter_battlefield','damage_all_enemies',2),a('Lava Blood','end_of_turn','damage_random_enemy',1)],
    64:[a('Overrun','static','trample'),a('Stampede','attacks','create_token',1,{tp:1,tt:1,tn:'Saproling'}),a('Keen Eye','static','vigilance')],
    67:[a('Overrun','static','trample'),a('Verdant Aura','static','pump_all_champions',1),a('Keen Eye','static','vigilance')],
    72:[a('Overrun','static','trample'),a('Vine Lash','attacks','damage_random_enemy',2),a('Keen Eye','static','vigilance')],
    111:[a('Deathshroud','static','deathtouch'),a('Siphon','static','lifelink'),a('Plague Breath','end_of_turn','drain_all_opponents',1)],
    112:[a('Deathshroud','static','deathtouch'),a('Siphon','static','lifelink'),a('Blight Aura','static','pump_all_champions',1)],
    115:[a('Deathshroud','static','deathtouch'),a('Devour','attacks','destroy_weakest_enemy',5),a('Siphon','static','lifelink')],
    144:[a('Flying','static','flying'),a('Intimidate','static','menace'),a('Abyssal Roar','enter_battlefield','bounce_enemies',2)],
    147:[a('Flying','static','flying'),a('Intimidate','static','menace'),a('Maelstrom Pull','attacks','tap_enemy_champion',1)],
    157:[a('Flying','static','flying'),a('Intimidate','static','menace'),a('Kraken Wake','attacks','damage_random_enemy',3)],
    166:[a('Keen Eye','static','vigilance'),a('Overrun','static','trample'),a('Fortify','enter_battlefield','create_token',2,{tp:1,tt:1,tn:'Golem'})],
    181:[a('Overrun','static','trample'),a('Keen Eye','static','vigilance'),a('Bull Rush','attacks','damage_random_enemy',2)],
    200:[a('Keen Eye','static','vigilance'),a('Overrun','static','trample'),a('Constrict','static','pump_all_champions',1)]
  };

  const spellPatch = {
    35:[a('Quick Deal','on_cast','draw_cards',1)],36:[a('Gold Rush','on_cast','ramp_search_land',1)],
    37:[a('Cornered Market','on_cast','damage_random_enemy',3)],38:[a('Payday Advance','on_cast','draw_cards',1)],
    39:[a('Hostile Takeover','on_cast','damage_all_enemies',2)],201:[a('Eruption','on_cast','damage_random_enemy',2)],
    202:[a('Lava Surge','on_cast','damage_random_enemy',3)],203:[a('Magma Volley','on_cast','damage_two_targets',2)],
    204:[a('Ashfall','on_cast','damage_any_target',1)],205:[a('Caldera Blast','on_cast','damage_all_enemies',3)],
    206:[a('Seismic Roar','on_cast','damage_random_enemy',3)],75:[a('Overgrowth','on_cast','create_token',2,{tp:1,tt:1,tn:'Saproling'})],
    76:[a('Wild Rage','on_cast','damage_random_enemy',4)],    77:[a("Nature's Rebuke",'on_cast','destroy_weakest_enemy',3),a("Rampant Growth",'on_cast','ramp_search_land',1)],
    78:[a('Season of Growth','on_cast','draw_cards',3)],79:[a('Feral Instinct','on_cast','create_token',1,{tp:3,tt:3,tn:'Beast'})],
    80:[a('Mycelium Burst','on_cast','damage_all_enemies',3)],207:[a('Verdant Bounty','on_cast','create_token',2,{tp:1,tt:1,tn:'Saproling'})],
    208:[a('Rootbind','on_cast','ramp_search_land',1)],209:[a('Timber Snap','on_cast','damage_random_enemy',3)],
    210:[a('Wildfire Bloom','on_cast','damage_all_enemies',2)],    211:[a('Canopy Crash','on_cast','damage_random_enemy',3),a("Wild Growth",'on_cast','ramp_search_land',1)],
    212:[a("Nature's Claim",'on_cast','destroy_relic',0)],118:[a('Withering Touch','on_cast','damage_random_enemy',1)],
    119:[a('Soul Drain','on_cast','drain_life',3)],120:[a('Plague Wind','on_cast','destroy_weakest_enemy',5)],
    213:[a('Dark Ritual','on_cast','ramp_search_land',2)],214:[a('Grave Pact','on_cast','destroy_all_enemies',0)],
    215:[a('Entomb','on_cast','return_from_graveyard',1)],216:[a('Blight Decay','on_cast','destroy_weakest_enemy',4)],
    217:[a('Necrotic Touch','on_cast','destroy_weakest_enemy',3)],218:[a('Siphon Life','on_cast','drain_life',2)],
    158:[a('Tidecall','on_cast','bounce_two_enemies',0)],159:[a('Abyssal Surge','on_cast','damage_all_enemies',2)],
    160:[a('Riptide Crush','on_cast','bounce_all_enemies',2)],219:[a('Tidal Lock','on_cast','tap_enemy_champion',1)],
    220:[a('Flood Surge','on_cast','bounce_champion',0)],221:[a('Whirlpool','on_cast','bounce_two_enemies',0)],
    222:[a('Brine Wave','on_cast','draw_cards',1),a("Tidal Pool",'on_cast','ramp_search_land',1)],223:[a('Depth Charge','on_cast','damage_all_enemies',4)],
    224:[a('Undertow Pull','on_cast','bounce_champion',0),a("Depths Beckon",'on_cast','ramp_search_land',1)],185:[a('Bolt','on_cast','damage_any_target',2)],
    186:[a('Reinforce','on_cast','create_token',1,{tp:2,tt:2,tn:'Golem'})],187:[a('Scrap Salvage','on_cast','return_from_graveyard',1)],
    188:[a('Overclock','on_cast','draw_cards',2)],189:[a('Disassemble','on_cast','destroy_relic',0)],
    190:[a('Chain Lightning','on_cast','damage_two_targets',2)],191:[a('Fortify','on_cast','create_token',1,{tp:1,tt:1,tn:'Golem'})],
    192:[a('Mass Recall','on_cast','bounce_all_enemies',2)],193:[a('Rust','on_cast','damage_random_enemy',1)],
    194:[a('Forge Shield','on_cast','create_token',2,{tp:1,tt:1,tn:'Golem'})],195:[a('Shrapnel Blast','on_cast','damage_random_enemy',5)],
    196:[a('Neutralize','on_cast','bounce_champion',0)],197:[a('Mind Spring','on_cast','draw_cards',3)],
    198:[a('Scrapheap Purge','on_cast','destroy_weakest_enemy',3)],199:[a('Pandemonium','on_cast','damage_all_enemies',5)],
    225:[a('Runic Infusion','on_cast','ramp_search_land',1)],226:[a('Arcane Catalyst','on_cast','draw_cards',1)],
    227:[a('Mana Resonator','on_cast','draw_cards',1)],228:[a('Pulse Drain','on_cast','drain_life',4)],
    229:[a('World Shatter','on_cast','destroy_all_enemies',0)],230:[a('Null Surge','on_cast','damage_all_enemies',3)],
    331:[a('Mana Surge','on_cast','ramp_search_land',1)],332:[a('Arcane Infusion','on_cast','draw_cards',1)],
    333:[a('Soul Resonance','on_cast','return_from_graveyard',1)]
  };

  const enchantPatch = {
    231:[a('Magma Forge','end_of_turn','damage_random_enemy',1)],232:[a('Lava Lake','end_of_turn','damage_all_enemies',1)],
    233:[a('Ember Heart','end_of_turn','damage_random_enemy',1)],234:[a('Ashcloud Mantle','static','pump_all_champions',2)],
    235:[a('Volcanic Rage','end_of_turn','damage_random_enemy',2)],236:[a('Molten Shield','enter_battlefield','damage_random_enemy',2)],
    237:[a('Eruption Ritual','end_of_turn','damage_random_enemy',3)],238:[a('Pyroclasm Veil','end_of_turn','damage_all_enemies',1)],
    239:[a('Cinderborn Vitality','static','pump_all_champions',1)],240:[a('Magma Chamber','end_of_turn','damage_random_enemy',1)],
    241:[a('Heartwood Resonance','static','pump_all_champions',1)],242:[a('Canopy Accord','end_of_turn','create_token',1,{tp:1,tt:1,tn:'Saproling'})],
    243:[a('Spore Bloom','enter_battlefield','create_token',1,{tp:1,tt:1,tn:'Saproling'})],244:[a('Root Network','end_of_turn','create_token',1,{tp:2,tt:2,tn:'Saproling'})],
    245:[a('Wild Growth','enter_battlefield','ramp_search_land',1)],246:[a('Elder Bond','static','pump_all_champions',1)],
    247:[a('Thornwall','end_of_turn','create_token',1,{tp:1,tt:1,tn:'Saproling'})],248:[a('Forestsong','end_of_turn','create_token',2,{tp:1,tt:1,tn:'Saproling'})],
    249:[a('Mycelium Web','static','pump_all_champions',1)],250:[a('Verdant Crown','static','pump_all_champions',2)],
    251:[a('Crypt Gate','end_of_turn','damage_random_enemy',1)],252:[a('Blight Aura','end_of_turn','drain_all_opponents',1)],
    253:[a('Graveyard Pact','enter_battlefield','return_from_graveyard',1)],254:[a('Rot Essence','end_of_turn','drain_all_opponents',1)],
    255:[a('Soul Harvest','end_of_turn','draw_cards',1)],256:[a('Withering Presence','end_of_turn','damage_random_enemy',1)],
    257:[a('Dread Veil','end_of_turn','drain_all_opponents',2)],258:[a('Corpse Garden','enter_battlefield','return_from_graveyard',2)],
    259:[a('Pestilence Cloud','end_of_turn','drain_all_opponents',2)],260:[a('Undying Shadow','static','pump_all_champions',1)],
    261:[a('Tidal Bind','end_of_turn','tap_enemy_champion',1)],262:[a('Deep Current','end_of_turn','draw_cards',1)],
    263:[a('Coral Throne','static','pump_all_champions',2)],264:[a('Riptide Ward','enter_battlefield','bounce_champion',0)],
    265:[a('Abyssal Gaze','end_of_turn','damage_random_enemy',2)],266:[a('Whirlpool Tether','end_of_turn','bounce_champion',0)],
    267:[a('Brine Mist','end_of_turn','tap_enemy_champion',1)],268:[a('Leviathan Wake','enter_battlefield','bounce_enemies',2)],
    269:[a('Undertow Snare','end_of_turn','tap_enemy_champion',1)],270:[a('Fathom Ward','end_of_turn','draw_cards',1)],
    271:[a('Mana Lens','end_of_turn','draw_cards',1)],272:[a('Arcane Conduit','end_of_turn','draw_cards',1)],
    273:[a('Runic Barrier','enter_battlefield','create_token',1,{tp:1,tt:1,tn:'Golem'})],274:[a('Crystal Resonance','end_of_turn','draw_cards',2)],
    275:[a('Null Field','end_of_turn','damage_random_enemy',2)],276:[a('Clockwork Core','end_of_turn','draw_cards',1)],
    277:[a('Thought Mirror','end_of_turn','draw_cards',1)],278:[a('Soulstone','enter_battlefield','return_from_graveyard',1)],
    279:[a('Void Pact','end_of_turn','drain_all_opponents',1)],280:[a('Nexus Anchor','static','extra_land_per_turn',1)],
    334:[a('Rusted Chain','end_of_turn','damage_random_enemy',1)],335:[a('Ore Vein','enter_battlefield','ramp_search_land',1)],
    336:[a('Grave Iron','static','pump_all_champions',1)],337:[a('Wild Sigil','end_of_turn','create_token',1,{tp:1,tt:1,tn:'Saproling'})]
  };

  const instantPatch = {
    281:[a('Lava Dart','on_cast','damage_any_target',1)],282:[a('Flame Burst','on_cast','damage_random_enemy',4)],
    283:[a('Magma Spray','on_cast','damage_random_enemy',2)],284:[a('Volcanic Hammer','on_cast','damage_random_enemy',4)],
    285:[a('Ember Gale','on_cast','damage_all_enemies',2)],286:[a('Inferno Trap','on_cast','damage_random_enemy',3)],
    287:[a('Ash Cloud','on_cast','damage_all_enemies',1)],288:[a('Magma Quake','on_cast','damage_all_enemies',3)],
    289:[a('Firebrand','on_cast','damage_two_targets',2)],290:[a('Cinder Storm','on_cast','damage_all_enemies',3)],
    291:[a('Giant Growth','on_cast','create_token',1,{tp:1,tt:1,tn:'Saproling'})],292:[a('Vine Snare','on_cast','bounce_champion',0)],
    293:[a("Nature's Bounty",'on_cast','draw_cards',1),a("Forage",'on_cast','ramp_search_land',1)],294:[a('Bramble Bash','on_cast','damage_random_enemy',3)],
    295:[a('Root Shield','on_cast','create_token',2,{tp:1,tt:1,tn:'Saproling'})],296:[a('Wild Charge','on_cast','damage_random_enemy',4)],
    297:[a('Overgrow','on_cast','create_token',1,{tp:2,tt:2,tn:'Saproling'})],298:[a('Timber Salvo','on_cast','damage_all_enemies',2)],
    299:[a('Feral Charge','on_cast','create_token',1,{tp:3,tt:3,tn:'Beast'})],    300:[a("Nature's Resolve",'on_cast','draw_cards',2),a("Bountiful Harvest",'on_cast','ramp_search_land',1)],
    301:[a('Fatal Push','on_cast','destroy_weakest_enemy',1)],302:[a('Doom Blade','on_cast','destroy_weakest_enemy',3)],
    303:[a('Dark Bargain','on_cast','draw_cards',2)],304:[a('Soul Reap','on_cast','destroy_weakest_enemy',3)],
    305:[a('Withering Gaze','on_cast','damage_random_enemy',2)],306:[a('Grasp of Darkness','on_cast','destroy_weakest_enemy',4)],
    307:[a('Drain Life','on_cast','drain_life',3)],308:[a('Ghoul Call','on_cast','create_token',1,{tp:2,tt:2,tn:'Zombie'})],
    309:[a('Pestilence','on_cast','drain_all_opponents',3)],310:[a('Dead Weight','on_cast','damage_random_enemy',2)],
    311:[a('Boomerang','on_cast','bounce_champion',0)],312:[a('Into the Roil','on_cast','bounce_champion',0)],
    313:[a('Counterspell','on_cast','bounce_all_enemies',1)],    314:[a('Aether Snag','on_cast','bounce_champion',0),a("Abyssal Path",'on_cast','ramp_search_land',1)],
    315:[a('Flood Recede','on_cast','bounce_champion',0)],    316:[a('Distant Melody','on_cast','draw_cards',2),a("Mariner's Guide",'on_cast','ramp_search_land',1)],
    317:[a('Deep Sea Serpent','on_cast','damage_random_enemy',3)],318:[a('Tidal Surge','on_cast','bounce_two_enemies',0)],
    319:[a('Rift Bolt','on_cast','damage_random_enemy',2)],320:[a('Vodalian Tactics','on_cast','damage_two_targets',2)],
    321:[a('Mana Leak','on_cast','damage_random_enemy',2)],322:[a('Repulse','on_cast','bounce_champion',0)],
    323:[a('Disenchant','on_cast','destroy_relic',0)],324:[a('Naturalize','on_cast','destroy_relic',0)],
    325:[a('Lightning Bolt','on_cast','damage_any_target',3)],326:[a('Fog','on_cast','damage_random_enemy',1)],
    327:[a('Think Twice','on_cast','draw_cards',2)],328:[a('Chaos Warp','on_cast','destroy_weakest_enemy',4)],
    329:[a('Rush of Adrenaline','on_cast','damage_random_enemy',3)],330:[a('Elixir of Immortality','on_cast','drain_life',3)],
    338:[a('Mana Burn','on_cast','damage_random_enemy',3)],339:[a('Echoing Rebuke','on_cast','damage_two_targets',2)],
    340:[a('Corrosive Touch','on_cast','destroy_relic',0)]
  };

  const kw = {
    21:['Swiftstrike'],22:['Swiftstrike'],23:['Swiftstrike'],24:['Swiftstrike'],
    25:['Quickdraw'],26:['Swiftstrike'],27:['Swiftstrike'],28:['Quickdraw'],
    29:['Quickdraw'],30:['Swiftstrike'],31:['Swiftstrike'],32:['Swiftstrike'],
    33:['Quickdraw'],34:['Swiftstrike'],40:['Quickdraw'],
    61:['Overrun'],62:['Keen Eye','Guard'],63:['Overrun'],65:['Swiftstrike'],66:['Flying'],
    68:['Keen Eye'],69:['Swiftstrike'],70:['Keen Eye','Overrun'],71:['Overrun'],73:['Keen Eye'],
    101:['Deathshroud'],102:['Swiftstrike'],103:['Siphon'],105:['Siphon'],106:['Deathshroud'],
    107:['Deathshroud'],108:['Siphon'],109:['Deathshroud','Guard'],110:['Siphon'],113:['Swiftstrike'],
    114:['Deathshroud'],116:['Swiftstrike'],117:['Deathshroud'],
     141:['Flying'],142:['Flying'],143:['Intimidate','Flying'],145:['Flying'],146:['Keen Eye','Flying'],
     148:['Intimidate','Flying'],149:['Swiftstrike','Flying'],150:['Flying'],151:['Keen Eye','Bastion','Flying'],
     152:['Flying'],153:['Flying'],154:['Swiftstrike','Flying'],155:['Flying'],156:['Flying'],157:['Flying'],
    161:['Swiftstrike'],162:['Swiftstrike'],163:['Keen Eye','Guard'],164:['Deathshroud'],
    167:['Quickdraw'],168:['Swiftstrike'],169:['Deathshroud'],171:['Keen Eye','Bastion'],
    172:['Swiftstrike'],174:['Quickdraw'],179:['Flying']
  };

  const strMap = {
    burn_enchantment:a('Scorch','on_cast','damage_relic',2),
    destroy_relic:a('Shatter','on_cast','destroy_relic',0),
    bounce_relic:a('Recede','on_cast','bounce_relic',0),
    disenchant:a('Disenchant','on_cast','destroy_relic',0)
  };

  const championRampPatch = {
    68:[a("Pathfinder",'enter_battlefield','ramp_search_land',1)],
    73:[a("Nature's Gift",'enter_battlefield','ramp_search_land',1)],
    66:[a("Spore Trail",'enter_battlefield','ramp_search_land',1)],
    71:[a("Alpha Call",'enter_battlefield','ramp_search_land',1)],
    146:[a("Tidal Insight",'enter_battlefield','ramp_search_land',1)],
    149:[a("Deep Scan",'enter_battlefield','ramp_search_land',1)],
    145:[a("Fathom Chart",'enter_battlefield','ramp_search_land',1)],
    148:[a("Reef Survey",'enter_battlefield','ramp_search_land',1)]
  };

  const recallPatch = {
    105:1, 107:1, 114:1, 117:1, 345:2, 363:1
  };

  const ominousPatch = {
    104:true, 110:true, 116:true, 364:true,
    366:true, 368:true, 370:true, 372:true
  };

  const rareSpells = new Set([205,78,214,160,199]);

  // Authored final rules text (display override) and italic flavor line.
  // `text` replaces the generated ability text; engine behavior still uses `abilities`.
  const textPatch = {
    21: 'Swiftstrike',
    28: 'Quickdraw',
    29: 'When you cast this, deal 2 damage to target relic.\nQuickdraw\nOverrun',
    35: 'Draw a card.',
    61: 'Overrun',
    64: 'Overrun\nWhen this attacks, create a 1/1 Saproling.\nKeen Eye',
    70: 'Destroy target enchantment.\nKeen Eye\nOverrun',
    74: 'Destroy target enchantment.',
    104: 'Ominous\nDestroy target enchantment.',
    152: 'Flying\nReturn target enchantment to your hand.',
    153: 'Flying\nReturn target enchantment to your hand.',
    341: 'When this enters, deal 2 damage to all enemy champions.\nSwiftstrike\nQuickdraw',
    343: 'When this enters, create two 2/2 Saprolings.\nKeen Eye\nOverrun',
    345: 'When this enters, return up to two cards from your graveyard to your hand.\nSiphon\nDeathshroud\nRecall 2',
    349: 'Search your deck for a basic land and put it into play.',
    355: 'Purge the weakest enemy champion.',
    363: 'Recall 1',
    364: 'Ominous',
    365: 'Omen — When your opponent casts a spell, deal 3 damage to any target.',
    373: 'Omen — At the start of your turn, your opponent purges one of their own champions.',
    485: 'Guard\nBastion',
    1011: 'Sacrifice a champion: draw a card.',
    1060: 'Whenever a champion attacks, target champion gets +1 attack this turn.',
    1095: 'Whenever you gain life, create a 1/1 Token.\nAt the start of your draw step, create a 1/1 Token.',
    1059: 'When this attacks with at least two other champions, it gains Guard until end of turn.',
    1065: 'Whenever this attacks, another target champion gets +1 attack this turn.',
    1036: 'Guard\nWhenever you reveal a card in your hand, this gets +1 attack until end of turn.',
    1084: 'Whenever you play a Decree, this gets +1 attack until end of turn.',
    1113: 'Whenever this attacks, it gets +2 attack until end of turn.',
    1041: 'Guard\nWhen this enters, reveal a card from your hand.\nWhen this enters, deal 1 damage and gain that much life.',
    1047: 'Guard\nWhen this attacks a hidden unit, destroy it.',
    1017: 'When this dies, create a 1/1 Token.',
    1071: 'Whenever you gain life, create a 1/1 Token.',
    149: 'Swiftstrike\nFlying\nWhen this enters, search your deck for a basic land and put it into play.',
    145: 'Flying\nWhen this enters, search your deck for a basic land and put it into play.',
    353: 'When this enters, search your deck for a basic land and put it into play.',
    38: 'Draw a card.',
    233: 'At the end of your turn, deal 2 damage to a random enemy.',
    291: 'Create a 1/1 Saproling.',
    361: 'Untap all your champions.',
    117: 'Deathshroud\nRecall 1',
    1089: 'Whenever you play a Decree, draw a card, then discard a card.',
    1097: 'When this enters, reveal a neutral card from your hand.',
    215: 'Return a card from your graveyard to your hand.',
    193: 'Deal 1 damage to a random enemy.',
    185: 'Deal 2 damage to any target.',
    1105: 'Once each turn, when you play a champion, target champion gets +1 attack this turn.',
    1112: 'Once each turn, when you play a neutral card, gain 1 life.',
    1118: 'Once each turn, after you play a neutral card, you may play an additional land this turn.',
    1015: 'Once each turn, when an ally dies, return it to your hand.',
    1022: 'Once each turn, when you sacrifice a champion, create a 1/1 Token.',
    1087: 'Once each turn, drain 1 life from your opponent.',
    1046: 'Once each turn, when you reveal a card, draw a card.',
    1063: 'Once each turn, when you attack, deal 1 damage to the enemy leader.',
    1070: 'Once each turn, when you attack with three or more allies, create a 2/2 Recruit.',
    506: 'Whenever you play a champion, gain 2 life.',
    555: 'Whenever you gain life, all your champions get +1 attack until end of turn.',
    369: 'Omen — When an ally dies, purge the weakest enemy champion and drain 2 life from your opponent.',
    371: 'Omen — When your opponent casts a spell, swap control of target enemy champion and one of your champions.',
    367: 'Omen — When you deal combat damage, tap target enemy champion and untap target champion.',
    553: 'Omen — When you deal combat damage, deal 2 damage to any target.',
    554: 'Omen — When an ally dies, return it to the battlefield with 1 life.',
    1013: 'Omen — When an ally dies, deal 2 damage to the enemy leader.',
    1021: 'Omen — At the end of your turn, return an ally from your graveyard to the battlefield with 1 life.',
    1085: 'Omen — The next card your opponent plays costs 2 more.',
    1093: 'Omen — The next Decree you play triggers twice.',
    1032: 'Omen — At the end of your turn, combat damage to your champions is reduced by 2 until your next turn.',
    342: 'Once per turn, sacrifice a champion: deal 3 damage.\nSwiftstrike',
    346: 'When this dies, destroy all enemy champions.\nAt the end of your turn, each opponent loses 2 life and you gain 2 life.\nDeathshroud',
    347: 'When this enters, return up to two enemy champions to hand.\nFlying\nIntimidate',
    348: 'Whenever this attacks, tap target enemy champion.\nPay 1 mana: return target champion to hand.\nFlying\nIntimidate',
    344: 'Overrun\nWhenever this attacks, create a 1/1 Saproling.\nKeen Eye',
    354: 'Swiftstrike\nWhen this enters, deal 2 damage to all enemy champions.\nAt the end of your turn, deal 1 damage to a random enemy.',
    370: 'Ominous\nWhen an ally dies, return a card from your graveyard to your hand.',
    1094: 'When this enters, return target Decree from your graveyard to your hand.',
    1096: 'Once each turn, when you play your second card, draw a card.',
    273: 'When this enters, create a 1/1 Golem.',
    278: 'When this enters, return a card from your graveyard to your hand.',
    279: 'At the end of your turn, each opponent loses 1 life and you gain 1 life.',
    280: 'You may play an additional land each turn.',
    334: 'At the end of your turn, deal 1 damage to a random enemy.',
    335: 'When this enters, search your deck for a basic land and put it into play.',
    336: 'Your champions get +1/+1.',
    337: 'At the end of your turn, create a 1/1 Saproling.',
    1101: 'Once each turn, when you reveal a card, scry 1.',
    1109: 'Once each turn, the first card you discard costs 1 less to play.',
    1114: 'Once each turn, when you gain life, search your deck for a basic land and put it into play.',
    231: 'At the end of your turn, deal 2 damage to a random enemy.',
    232: 'At the end of your turn, deal 2 damage to all enemy champions.',
    234: 'Your champions get +2/+2.',
    236: 'When this enters, deal 2 damage to a random enemy.',
    239: 'Your champions get +1/+1.',
    350: 'Your Crimson champions deal double combat damage.',
    1012: 'Your drain effects heal 1 extra life.',
    262: 'At the end of your turn, draw a card.',
    263: 'Your champions get +2/+2.',
    268: 'When this enters, return up to two enemy champions to hand.',
    270: 'At the end of your turn, draw a card.',
    1083: 'Once each turn, when you discard a card, scry 1.',
    251: 'At the end of your turn, deal 1 damage to a random enemy.',
    253: 'When this enters, return a card from your graveyard to your hand.',
    255: 'At the end of your turn, draw a card.',
    258: 'When this enters, return up to two cards from your graveyard to your hand.',
    242: 'At the end of your turn, create a 1/1 Saproling.',
    243: 'When this enters, create a 1/1 Saproling.',
    245: 'When this enters, search your deck for a basic land and put it into play.',
    238: 'At the end of your turn, deal 2 damage to all enemy champions.',
    240: 'At the end of your turn, deal 2 damage to a random enemy.',
    241: 'Your champions get +1/+1.',
    246: 'Your champions get +1/+1.',
    247: 'At the end of your turn, create a 1/1 Saproling.',
    249: 'Your champions get +1/+1.',
    250: 'Your champions get +2/+2.',
    252: 'At the end of your turn, each opponent loses 1 life and you gain 1 life.',
    254: 'At the end of your turn, each opponent loses 1 life and you gain 1 life.',
    256: 'At the end of your turn, deal 1 damage to a random enemy.',
    257: 'At the end of your turn, each opponent loses 2 life and you gain 2 life.',
    259: 'At the end of your turn, each opponent loses 2 life and you gain 2 life.',
    260: 'Your champions get +1/+1.',
    261: 'At the end of your turn, tap target enemy champion.',
    264: 'When this enters, return a champion to its owner\u2019s hand.',
    265: 'At the end of your turn, deal 2 damage to a random enemy.',
    267: 'At the end of your turn, tap target enemy champion.',
    269: 'At the end of your turn, tap target enemy champion.',
    275: 'At the end of your turn, deal 2 damage to a random enemy.',
    521: 'Your champions get +0/+1.',
    522: 'Whenever you gain life, scry 1.',
    523: 'Whenever you play a champion, you gain 1 life.',
    524: 'Your drain effects heal 1 extra life.',
    526: 'Whenever one of your champions dies, deal 2 damage to a random enemy.',
    527: 'Whenever one of your champions dies, you gain 3 life.',
    528: 'At the end of your turn, deal 1 damage to all enemy champions.',
    529: 'Pay 4: Return a card from your graveyard to your hand. Activate only once each turn.',
    1037: 'Once each turn, when you reveal a card, the next Decree you play costs 1 less.',
    1068: 'Once each turn, whenever a champion you control attacks, you gain 1 life.',
    1019: 'When you play this, each opponent loses 2 life and you gain 2 life. If a champion died this turn, draw a card.',
    356: 'When you play this, scry 2.',
    358: 'When you play this, the next card you play costs 2 less and each opponent discards a card.',
    357: 'When you play this, untap up to two champions you control.',
    494: 'When you play this, destroy the weakest enemy champion.',
    499: 'When you play this, each opponent destroys a champion they control of their choice.',
    // Wave 6 Batch 1 — Sunforged & Lantern Instants/Spells
    75: 'Create two 1/1 Saprolings.',
    76: 'Deal 4 damage to a random enemy champion.',
    77: 'Destroy the weakest enemy champion.\nSearch your deck for a basic land and put it into play. Then shuffle your deck.',
    78: 'Draw three cards.',
    79: 'Create a 3/3 Beast.',
    80: 'Deal 3 damage to all enemy champions.',
    207: 'Create two 1/1 Saprolings.',
    208: 'Search your deck for a basic land and put it into play. Then shuffle your deck.',
    209: 'Deal 3 damage to a random enemy champion.',
    210: 'Deal 2 damage to all enemy champions.',
    211: 'Deal 3 damage to a random enemy champion.\nSearch your deck for a basic land and put it into play. Then shuffle your deck.',
    212: 'Destroy target relic.',
    292: 'Return target champion to its owner\u2019s hand.',
    293: 'Draw a card.\nSearch your deck for a basic land and put it into play. Then shuffle your deck.',
    294: 'Deal 3 damage to a random enemy champion.',
    295: 'Create two 1/1 Saprolings.',
    296: 'Deal 4 damage to a random enemy champion.',
    297: 'Create a 2/2 Saproling.',
    298: 'Deal 2 damage to all enemy champions.',
    299: 'Create a 3/3 Beast.',
    300: 'Draw two cards.\nSearch your deck for a basic land and put it into play. Then shuffle your deck.',
    118: 'Deal 1 damage to a random enemy champion.',
    119: 'Drain 3 life from target champion or player.',
    120: 'Destroy the weakest enemy champion.',
    213: 'Search your deck for two basic lands and put them into play. Then shuffle your deck.',
    214: 'Destroy all enemy champions.',
    216: 'Destroy the weakest enemy champion.',
    217: 'Destroy the weakest enemy champion.',
    218: 'Drain 2 life from target champion or player.',
    301: 'Destroy the weakest enemy champion.',
    // Wave 6 Batch 2 — Lantern, Gilded, Colorless Instants/Spells
    302: 'Destroy the weakest enemy champion.',
    303: 'Draw two cards.',
    304: 'Destroy the weakest enemy champion.',
    305: 'Deal 2 damage to a random enemy champion.',
    306: 'Destroy the weakest enemy champion.',
    307: 'Drain 3 life from target champion or player.',
    308: 'Create a 2/2 Zombie.',
    309: 'Each opponent loses 3 life and you gain 3 life.',
    310: 'Deal 2 damage to a random enemy champion.',
    158: 'Return up to two enemy champions to their owners\u2019 hands.',
    159: 'Deal 2 damage to all enemy champions.',
    160: 'Return all enemy champions to their owners\u2019 hands.',
    219: 'Tap target enemy champion.',
    220: 'Return target champion to its owner\u2019s hand.',
    221: 'Return up to two enemy champions to their owners\u2019 hands.',
    222: 'Draw a card.\nSearch your deck for a basic land and put it into play. Then shuffle your deck.',
    223: 'Deal 4 damage to all enemy champions.',
    224: 'Return target champion to its owner\u2019s hand.\nSearch your deck for a basic land and put it into play. Then shuffle your deck.',
    311: 'Return target champion to its owner\u2019s hand.',
    312: 'Return target champion to its owner\u2019s hand.',
    313: 'Return up to one enemy champion to its owner\u2019s hand.',
    314: 'Return target champion to its owner\u2019s hand.\nSearch your deck for a basic land and put it into play. Then shuffle your deck.',
    315: 'Return target champion to its owner\u2019s hand.',
    316: 'Draw two cards.\nSearch your deck for a basic land and put it into play. Then shuffle your deck.',
    317: 'Deal 3 damage to a random enemy champion.',
    318: 'Return up to two enemy champions to their owners\u2019 hands.',
    319: 'Deal 2 damage to a random enemy champion.',
    320: 'Deal 2 damage to two target champions.',
    186: 'Create a 2/2 Golem.',
    187: 'Return a card from your graveyard to your hand.',
    // Wave 6 Batch 3 — Colorless Instants/Spells
    188: 'Draw two cards.',
    189: 'Destroy target relic.',
    190: 'Deal 2 damage to two target champions.',
    191: 'Create a 1/1 Golem.',
    192: 'Return up to two enemy champions to their owners\u2019 hands.',
    194: 'Create two 1/1 Golems.',
    195: 'Deal 5 damage to a random enemy champion.',
    196: 'Return target champion to its owner\u2019s hand.',
    197: 'Draw three cards.',
    198: 'Destroy the weakest enemy champion.',
    199: 'Deal 5 damage to all enemy champions.',
    225: 'Search your deck for a basic land and put it into play. Then shuffle your deck.',
    226: 'Draw a card.',
    227: 'Draw a card.',
    228: 'Drain 4 life from target champion or player.',
    229: 'Destroy all enemy champions.',
    230: 'Deal 3 damage to all enemy champions.',
    331: 'Search your deck for a basic land and put it into play. Then shuffle your deck.',
    332: 'Draw a card.',
    333: 'Return a card from your graveyard to your hand.',
    321: 'Deal 2 damage to a random enemy champion.',
    322: 'Return target champion to its owner\u2019s hand.',
    323: 'Destroy target relic.',
    324: 'Destroy target relic.',
    325: 'Deal 3 damage to any target.',
    326: 'Deal 1 damage to a random enemy champion.',
    327: 'Draw two cards.',
    328: 'Destroy the weakest enemy champion.',
    329: 'Deal 3 damage to a random enemy champion.',
    330: 'Drain 3 life from target champion or player.',
    // Wave 6 Batch 4 — Colorless (remaining) + Crimson Instants/Spells
    338: 'Deal 3 damage to a random enemy champion.',
    339: 'Deal 2 damage to two target champions.',
    340: 'Destroy target relic.',
    36: 'Search your deck for a basic land and put it into play. Then shuffle your deck.',
    37: 'Deal 3 damage to a random enemy champion.',
    39: 'Deal 2 damage to all enemy champions.',
    201: 'Deal 3 damage to a random enemy champion.',
    202: 'Deal 3 damage to a random enemy champion.',
    203: 'Deal 2 damage to two target champions.',
    204: 'Deal 2 damage to any target.',
    205: 'Deal 4 damage to all enemy champions.',
    206: 'Deal 3 damage to a random enemy champion.',
    281: 'Deal 2 damage to any target.',
    282: 'Deal 4 damage to a random enemy champion.',
    283: 'Deal 3 damage to a random enemy champion.',
    284: 'Deal 4 damage to a random enemy champion.',
    285: 'Deal 2 damage to all enemy champions.',
    286: 'Deal 3 damage to a random enemy champion.',
    287: 'Deal 1 damage to all enemy champions.',
    288: 'Deal 3 damage to all enemy champions.',
    289: 'Deal 2 damage to two target champions.',
    290: 'Deal 3 damage to all enemy champions.',
    487: 'Swiftstrike',
    493: 'When this attacks, deal 2 damage to a random enemy.',
    495: 'Overrun\nQuickdraw',
    496: 'When this dies, deal 2 damage to all enemy champions.',
    497: 'All combat damage to your side is reduced by 3 this turn.',
    498: 'Guard\nWhen this attacks, ready target friendly champion.',
    501: 'Bastion\nSiphon\nAt the end of your turn, gain 3 life.',
    503: 'Guard\nWhen this attacks, drain 2 life from target enemy.',
    504: 'Destroy all enemy champions.',
    505: 'Whenever you gain life, all your champions get +1/+1.\nAt the end of your turn, gain 2 life.',
    507: 'Keen Eye\nWhen this enters, ready all friendly champions.\nWhen this attacks, all your champions get +2/+2.',
    508: 'Overrun\nDeathshroud\nWhen this enters, deal 4 damage to all enemy champions.\nWhen this attacks, purge the weakest enemy champion.',
    509: 'Swiftstrike',
    510: 'Guard',
    514: 'Siphon\nWhenever you gain life, this gets +1/+1.',
    515: 'Keen Eye\nWhen this attacks, deal 2 damage to a random enemy.',
    516: 'Overrun',
    517: 'Guard\nWhen this attacks, all your champions get +1/+1.',
    518: 'When this enters, purge the weakest enemy champion.',
    519: 'Intimidate\nWhen this attacks, deal 3 damage to any target.',
    533: 'Purge the weakest enemy champion.',
    534: 'Draw 2 cards.',
    535: 'Deal 5 damage to any target.',
    536: 'Deal 3 damage to all enemy champions.',
    537: 'Return a card from your graveyard to your hand.',
    538: 'Purge all enemy champions.',
    539: 'Target champion gets -2 attack this turn.',
    540: 'Target champion gets +3 toughness this turn.',
    541: 'All combat damage to your side is reduced by 2 this turn.',
    542: 'Destroy target hidden (face-down) card.',
    543: 'Tap target enemy champion.',
    544: 'Drain 3 life from target champion or player.',
    545: 'Ready target friendly champion.',
    546: 'Sacrifice a champion: deal 4 damage to a random enemy.',
    547: 'All combat damage to your side is reduced by 5 this turn.',
    550: 'When you play this, purge target enemy champion.',
    551: 'When you play this, ready all friendly champions.',
    552: 'When you play this, each opponent purges 2 champions they control of their choice.',
    576: 'Swiftstrike',
    577: 'Guard',
    578: 'Siphon',
    579: 'Bastion\nGuard',
    580: 'Keen Eye\nWhen this enters, purge target enemy champion.\nWhen this attacks, deal 2 damage to any target.',
    581: 'Flying\nSiphon\nOverrun\nWhen this enters, purge all enemy champions.\nWhen this attacks, all your champions get +2/+2.'
  };
  const flavorPatch = {
    21: 'Every coin has two sides; this one has a sword.',
    28: 'It melts what it guards. Usually it guards coins.',
    29: 'Back alley bravado backed by a chariot of fire.',
    35: 'Faster than a coin flip. Almost.',
    61: 'The jungle does not ask permission.',
    64: 'Every footstep seeds the next warcamp.',
    70: 'Roots older than the kingdom, anger older than the roots.',
    74: 'Thorns remember every trespass.',
    104: 'The mire swallows both blessing and curse.',
    152: 'What the whirlpool takes, the whirlpool gives back.',
    153: 'Dragons of the reef guard their hoard of shipwrecks.',
    341: 'Mountains bow to her; so do battlefields.',
    343: 'Its roots drink from the world\u2019s rivers; its leaves touch the sky\u2019s crown.',
    345: 'Death is a ledger, and he holds the pen.',
    349: 'A crack in the earth that leads somewhere richer.',
    355: 'The fire names its price.',
    363: 'A noble born in shadow, buried without ceremony.',
    364: 'It waits beneath the feast-hall floor.',
    365: 'Some treasures bite.',
    373: 'The deck is always stacked \u2014 for someone.',
    485: 'The first through the gate; the last to step back.',
    1011: 'Blood has a price; in Crimson, it comes with a receipt.',
    1060: 'Nine legions marched to one heartbeat.',
    1095: 'Wealth is a promise; he keeps his word in gold.',
    1059: 'Where the spearline holds, the sky agrees.',
    1065: 'He conquers by reputation; his men finish the work.',
    1036: 'It sees through brambles and lies alike.',
    1084: 'Every output requires an honest input.',
    1113: 'There is no rulebook on the open road.',
    1041: 'The day bleeds, but the dawn endures.',
    1047: 'Every monster he buried was once a man\u2019s mistake.',
    1017: 'His first bite came with a royal decree.',
    1071: 'He who gives gold makes the wealth grow.',
    149: 'The deep yields only to those who do not fear it.',
    145: 'It reads the floor where the drowned left advice.',
    353: 'Every wave is a border waiting to be drawn.',
    22: 'A coin\u2019s spirit, lightning-fast and just as fragile.',
    23: 'Fresh from the press and already on duty.',
    27: 'It counts your fortune before you know you risked it.',
    30: 'Heads, mayhem. Tails, worse.',
    38: 'Gold now, gold later \u2014 interest is a hunter.',
    233: 'The furnace never cools; it only waits.',
    291: 'What the forest promises, the forest delivers.',
    361: 'Rest is a weapon; wield it well.',
    101: 'Cities fall to kings; kings fall to rats.',
    117: 'It returns for the life it was owed.',
    1089: 'Thinking is a decree writ in equations.',
    1097: 'Every road is for sale to the right coin.',
    509: 'Repentance has a sharp edge.',
    487: 'The pilgrimage ends at the blade\u2019s point.',
    576: 'Faith is the first lesson; the sword is the second.',
    215: 'Even the dead deserve a final filing.',
    193: 'Time is patient; so is rust.',
    185: 'The sky keeps its receipts.',
    1105: 'Generals still march where the grass won\u2019t grow.',
    1112: 'Borders are suggestions between friends.',
    1118: 'One fire, a thousand roads.',
    1015: 'The masks remember every face that wore them.',
    1022: 'The dead dance last and longest.',
    1087: 'Small favors, kept under lock.',
    1046: 'Truth, once spoken, is never hidden again.',
    1063: 'An army\u2019s promise, planted like seed.',
    1070: 'Every campfire is a victory claimed.',
    506: 'Consecrated ground for unbeaten hearts.',
    555: 'The sun keeps its roll call at dawn.',
    369: 'The grave breathes in; something answers.',
    371: 'The vault swaps rivals before the mark can blink.',
    367: 'Mirrors are merciless; they return everything.',
    553: 'A contract sealed in fire is never renegotiated.',
    554: 'Every candle drowned is one relit.',
    1013: 'The bell tolls for the enemy\u2019s payday.',
    1021: 'That which is buried still wants out \u2014 for dinner.',
    1085: 'The prophecy was wrong \u2014 on purpose.',
    1093: 'A reflected contradiction, faithfully repeating.',
    1032: 'Saffron smells of mourning and enormous dinners.',
    342: 'A volcano with a grudge and an appetite.',
    346: 'Disease crowned where kings grow thin.',
    347: 'The sea vaults its debts; it collects with interest.',
    348: 'The tide obeys only those who never ask twice.',
    344: 'The green court\u2019s word grows forests.',
    354: 'His blood is a river letting the mountain out.',
    370: 'What Korath binds, no lock holds back.',
    1094: 'Every ending is filed for reference.',
    1096: 'She re-reads the secondhand hour.',
    273: 'The first rule of the veil: keep it whole.',
    278: 'Every memory has a proper weight.',
    279: 'Nothing leaves; nothing is forgotten.',
    280: 'One port, ported forever — the anchor knows the way.',
    334: 'Jail ends; rust doesn\u2019t.',
    335: 'Dig where the mountain hints.',
    336: 'War is buried; iron is not.',
    337: 'A leaf drawn in anger, rooted in patience.',
    1101: 'Carry a lantern; the dark is only temporary.',
    1109: 'Where there\u2019s a road, there\u2019s a fire.',
    1114: 'Silver answers every distance.',
    231: 'Bars of fire, coined in the foundry\u2019s heart.',
    232: 'What the lake keeps, it keeps boiling.',
    234: 'The cloud remembers the fire.',
    236: 'Prove your mettle, or melt.',
    239: 'From ash, the cinderborn stride.',
    350: 'Glass worked in darkness, burning bright.',
    1012: 'A cup that drinks to the dead and their debts.',
    262: 'Below the surface, the sea keeps accounts.',
    263: 'The reef crowns patience.',
    268: 'Where the leviathan passes, ships start over.',
    270: 'Prison for what the sea remembers.',
    1083: 'Catalogued, ordered, and fast.',
    251: 'The crypt is never locked against appetite.',
    253: 'Older contracts than any vote.',
    255: 'The reaper itemizes.',
    258: 'You plant a life; you reap a debt.',
    242: 'The forest votes every season.',
    243: 'Blooms that pay their rent in armies.',
    245: 'Growth is the oldest law.',
    238: 'The final curtain is fire.',
    240: 'Pressure builds; the mountain answers.',
    241: 'The heartwood hums the forest\u2019s anthem.',
    246: 'Root and branch, sworn to one decree.',
    247: 'The garden is armed.',
    249: 'One voice, ten thousand roots.',
    250: 'The forest crowns its defenders.',
    252: 'The bloom of endings.',
    254: 'Every return begins with rot.',
    256: 'It aches to be near the dying.',
    257: 'Fear wears a hooded coat.',
    259: 'The sky sighs and sows.',
    260: 'What does not die endures as witness.',
    261: 'The tide keeps its tally.',
    264: 'The undertow keeps what it takes.',
    265: 'Something ancient looks back.',
    267: 'Salt fog forgets no ships.',
    269: 'The sand remembers every step.',
    275: 'Silence, then nothing stalks through.',
    521: 'Woven from hymns and brass.',
    522: 'Every oath, indexed in light.',
    523: 'The flame outlasts the vigil\u2019s candles.',
    524: 'Grace, poured to the last drop.',
    526: 'The fire judges; the ash remembers.',
    527: 'The first to fall is never last.',
    528: 'They cower in the shadow of noon.',
    529: 'In the sun\u2019s keeping, nothing is lost forever.',
    1037: 'One step above your station.',
    1068: 'A banner older than the war it outlasts.',
    1019: 'Debts are settled in whatever coin remains.',
    356: 'What is foreseen may yet be forgiven.',
    358: 'Law written in unlit ink.',
    357: 'The king\u2019s word recalls the garden.',
    494: 'Holiness, by arbitration.',
    499: 'Every answer is another question\u2019s warrant.',
    // Wave 6 Batch 1 — Sunforged & Lantern Instants/Spells
    75: 'The forest answers every prayer with a thousand seedlings.',
    76: 'Rage is a season; it blooms and burns in a single turn.',
    77: 'Nature does not negotiate. It reclaims.',
    78: 'Growth is the only ledger the wild keeps.',
    79: 'Instinct needs no teacher; the woods provide the lesson.',
    80: 'The mycelium remembers every footfall. It collects.',
    207: 'A harvest sown in patience, reaped in armies.',
    208: 'Roots know the way; the traveler need only follow.',
    209: 'Old timber snaps loudest when the wind turns.',
    210: 'Wildfire does not ask permission to bloom.',
    211: 'The canopy crashes down; the forest floor rises.',
    212: 'Even iron rusts when the vines decide it\u2019s time.',
    292: 'The vine does not chase; it waits where the path must cross.',
    293: 'Every fruit carries a seed; every seed, a map.',
    294: 'Thorns strike where the bark is thinnest.',
    295: 'Roots rise where the foot falls heaviest.',
    296: 'The stampede answers the call before the horn sounds.',
    297: 'Growth is not gentle. It is inevitable.',
    298: 'The forest speaks in falling timber.',
    299: 'The beast does not wait for an invitation.',
    300: 'Resolve is a seed; the harvest is certainty.',
    118: 'A touch that lingers long after the hand withdraws.',
    119: 'Life is a debt; death collects with interest.',
    120: 'The wind carries no names, only endings.',
    213: 'Blood waters the roots of forbidden knowledge.',
    214: 'The pact is signed in silence; the witness is dust.',
    216: 'Decay is patient. It always wins the long game.',
    217: 'A touch that turns vigor to rot in a heartbeat.',
    218: 'The lantern drinks what the living spill.',
    301: 'The smallest push topples the tallest corpse.',
    // Wave 6 Batch 2 — Lantern, Gilded, Colorless Instants/Spells
    302: 'The blade finds the frailest neck.',
    303: 'Knowledge costs blood; the ledger balances itself.',
    304: 'Reap what the grave has sown.',
    305: 'A glance that withers steel and flesh alike.',
    306: 'Darkness grips tightest where the light is weakest.',
    307: 'Life flows where the lantern points.',
    308: 'The dead answer every summons.',
    309: 'The plague does not discriminate; it collects.',
    310: 'Even feathers grow heavy when the mire claims them.',
    158: 'The tide takes what the shore forgets.',
    159: 'The abyss rises; the surface drowns.',
    160: 'No anchor holds against the crushing deep.',
    219: 'The current decides who moves.',
    220: 'What the wave brings, the wave takes back.',
    221: 'The undertow respects no allegiance.',
    222: 'Songs of the deep carry maps to buried wealth.',
    223: 'Pressure at depth crushes hulls and armies alike.',
    224: 'The pull is gentle; the return is not.',
    311: 'A toy that always comes back \u2014 until it doesn\u2019t.',
    312: 'The oil-slick path leads only one way: back.',
    313: 'The counter-spell is a ripple that unravels the cast.',
    314: 'Snag the thread; the tapestry unravels.',
    315: 'The flood recedes; the stranded remain.',
    316: 'Melodies from the deep chart roads to forgotten riches.',
    317: 'The serpent strikes where the water is darkest.',
    318: 'Tides turn; enemies return to sender.',
    319: 'A bolt that splits the sky and the defense.',
    320: 'Two targets, one current \u2014 neither escapes.',
    186: 'Iron obeys the hand that forged it.',
    187: 'Scrap remembers the shape it once held.',
    // Wave 6 Batch 3 — Colorless Instants/Spells
    188: 'The gears turn faster when the stakes rise.',
    189: 'Every construct has a seam; the right tool finds it.',
    190: 'One spark jumps the gap; the second completes the circuit.',
    191: 'Iron answers the call; the foundry never sleeps.',
    192: 'The signal recalls what the front forgot.',
    194: 'Twice forged, twice bound \u2014 the shield wall holds.',
    195: 'Scrap becomes shrapnel; the foundry wastes nothing.',
    196: 'Neutralize the threat; the equation balances to zero.',
    197: 'The spring unwinds; the mind opens wide.',
    198: 'Rust claims the weak; the furnace sorts the rest.',
    199: 'Chaos is a machine; wind it tight and watch it break.',
    225: 'The leyline hums; the path reveals itself.',
    226: 'A catalyst needs only a drop to start the chain.',
    227: 'Mana sings in the wire; the resonator listens.',
    228: 'The pulse takes from one, gives to the other.',
    229: 'The world breaks; the artifacts endure.',
    230: 'The surge cancels the noise; silence remains.',
    331: 'The leyline surges; the traveler finds the gate.',
    332: 'Infuse the circuit; the spark becomes a current.',
    333: 'The soul echoes; the grave answers.',
    321: 'The leak springs where the pressure is highest.',
    322: 'Repulse the advance; the line holds.',
    323: 'The enchantment unravels; the thread is cut.',
    324: 'Nature reclaims what artifice built.',
    325: 'The bolt finds its mark before the thunder speaks.',
    326: 'A moment\u2019s haze; the strike misses its mark.',
    327: 'Think once, think twice \u2014 the answer changes.',
    328: 'Chaos rewrites the rules; the weakest falls first.',
    329: 'Adrenaline burns hot; the enemy burns hotter.',
    330: 'Immortality is a loan; the collector comes calling.',
    // Wave 6 Batch 4 — Colorless (remaining) + Crimson Instants/Spells
    338: 'The mana flares; the caster pays in kind.',
    339: 'Two wounds, one echo.',
    340: 'Acid finds the seam in every ward.',
    36: 'Gold fuels the march; the mountain provides.',
    37: 'The market corners itself when the blade sets the price.',
    39: 'Hostile takeovers are settled in ash.',
    201: 'The earth cracks; fire answers.',
    202: 'Lava does not negotiate; it consumes.',
    203: 'Twin volleys; the mountain speaks twice.',
    204: 'Ash falls where the ember kissed.',
    205: 'The caldera opens; the valley fills with fire.',
    206: 'The ground shakes; the enemy breaks.',
    281: 'A dart of molten glass; small, sharp, final.',
    282: 'The burst does not ask permission.',
    283: 'Spray the forge; the metal remembers.',
    284: 'The hammer falls; the anvil screams.',
    285: 'The gale carries cinders, not mercy.',
    286: 'The trap springs; the intruder burns.',
    287: 'Ash chokes the sky; the living choke faster.',
    288: 'The quake splits the line; fire fills the gap.',
    289: 'Two brands; one forge.',
    290: 'The storm is cinder; the forecast is ruin.',
    487: 'A sword that outlives every oath it serves.',
    493: 'War and liturgy, delivered in the same breath.',
    495: 'The charge bellows louder than the choir.',
    496: 'The candle that spends itself lighting the way.',
    498: 'One host, one heartbeat, one wall of gold.',
    501: 'She is the cathedral; the faithful are her columns.',
    503: 'The Order answers with a closed fist and an open book.',
    504: 'What fire does not refine, it forgives.',
    505: 'Every hymn is a ledger; she balances it nightly.',
    507: 'He wins the battle before it is offered.',
    508: 'The sun, given a sword and a grievance.',
    509: 'Repentance is a doorway; this sword is the hinge.',
    510: 'The smoke rises; the flock sleeps on.',
    514: 'He has stopped counting what the flame takes.',
    515: 'The verdict is writ in light, not ink.',
    516: 'Night is a heresy she rides to correct.',
    517: 'Where the banner stands, the line holds.',
    518: 'He does not judge; he only hears the scales.',
    519: 'Mercy is not a sentence; it is a reprieve.',
    533: 'Alloys of doubt burn at the first holy touch.',
    534: 'The light returns before the faithful rise.',
    535: 'A column of judgment poured from the sky.',
    536: 'Righteousness, given a war to spend itself on.',
    537: 'The divine remembers what mortals bury.',
    538: 'One last lantern, kept for those already gone.',
    539: 'The light arrives a moment before the truth does.',
    540: 'Faith, forged into a shield that outlasts its bearer.',
    541: 'A parry that feeds the attacker their own doubt.',
    542: 'Even the shadow knows it is no match for noon.',
    543: 'The heavens open; the ambush closes its eyes.',
    544: 'The rebuke finds the wound the sin left behind.',
    545: 'The faithful are never lost, only unpaged.',
    546: 'Every sacrifice is a sermon.',
    547: 'The wall of faith has no hinges.',
    550: 'The gates of the church are open; the gates of the faith are not.',
    551: 'Peace is a weapon the faithful keep sharp.',
    552: 'The ledger of retribution is kept in duplicate.',
    576: 'Born at the altar, blooded at the gate.',
    577: 'The threshold is sacred; so is the guard.',
    578: 'Asceticism is the first lance he ever carried.',
    579: 'The vow outbids the flesh.',
    580: 'He extracts heresy the way old trees shed bark.',
    581: 'The archangel carries the sunrise like a siege tower.'
  };

  // -------------------------------------------------------------------------
  // Rebalance deltas (v0.1050) — Crimson bolster only. Engine vocabulary
  // unchanged; rarity/type/identity frozen by the passes above. Values and
  // keywords here are the canonical end state (display text re-authored below).
  // Crimson identity: cheap aggression + combat reach (Overrun/Intimidate) +
  // the dormant red-exclusive double_fire_damage engine hook (Obsidian Forge).
  // Drain stays Lantern-aligned — not used as a primary Crimson mechanic.
  // -------------------------------------------------------------------------
  const rebalancePatch = {
    21:  { power: 2 },
    23:  { power: 2 },
    27:  { power: 2 },
    29:  { abilities: [
      {name: 'Scorch', trigger: 'on_cast', effect: 'damage_relic', value: 2, oncePerTurn: false, activationCost: null},
      'Quickdraw', 'Overrun'
    ]},
    30:  { abilities: ['Swiftstrike', 'Intimidate'] },
    31:  { abilities: [
      {name: 'Scorch', trigger: 'on_cast', effect: 'damage_relic', value: 2, oncePerTurn: false, activationCost: null},
      'Swiftstrike', 'Overrun'
    ]},
    201: { abilities: [{name: 'Eruption', trigger: 'on_cast', effect: 'damage_random_enemy', value: 3, oncePerTurn: false, activationCost: null}] },
    204: { abilities: [{name: 'Ashfall', trigger: 'on_cast', effect: 'damage_any_target', value: 2, oncePerTurn: false, activationCost: null}] },
    205: { abilities: [{name: 'Caldera Blast', trigger: 'on_cast', effect: 'damage_all_enemies', value: 4, oncePerTurn: false, activationCost: null}] },
    231: { abilities: [{name: 'Magma Forge', trigger: 'end_of_turn', effect: 'damage_random_enemy', value: 2, oncePerTurn: false, activationCost: null}] },
    232: { abilities: [{name: 'Lava Lake', trigger: 'end_of_turn', effect: 'damage_all_enemies', value: 2, oncePerTurn: false, activationCost: null}] },
    233: { abilities: [{name: 'Ember Heart', trigger: 'end_of_turn', effect: 'damage_random_enemy', value: 2, oncePerTurn: false, activationCost: null}] },
    238: { abilities: [{name: 'Pyroclasm Veil', trigger: 'end_of_turn', effect: 'damage_all_enemies', value: 2, oncePerTurn: false, activationCost: null}] },
    240: { abilities: [{name: 'Magma Chamber', trigger: 'end_of_turn', effect: 'damage_random_enemy', value: 2, oncePerTurn: false, activationCost: null}] },
    281: { abilities: [{name: 'Lava Dart', trigger: 'on_cast', effect: 'damage_any_target', value: 2, oncePerTurn: false, activationCost: null}] },
    283: { abilities: [{name: 'Magma Spray', trigger: 'on_cast', effect: 'damage_random_enemy', value: 3, oncePerTurn: false, activationCost: null}] },
    350: { abilities: [{name: 'Obsidian Forge', trigger: 'static', effect: 'double_fire_damage', value: 1, oncePerTurn: false, activationCost: null}] },
    366: { abilities: ['Ominous', {name: 'Wild Rampage', trigger: 'ON_COMBAT_DAMAGE', effect: 'pump_self_stats', value: 2, oncePerTurn: false, activationCost: null}, 'Overrun'] }
  };

  cards = cards.map(c => {
    if (c.type === 'Land') return {...c, rarity:'Common', name:c.color + ' Land'};
    if (legendaryChampionIds.has(c.id)) {
      return {...c, rarity:'Legendary', abilities:legendaryKit[c.id] || c.abilities};
    }
    const patch = spellPatch[c.id] || enchantPatch[c.id] || instantPatch[c.id];
    if (patch) c = {...c, abilities:patch};
    if (c.type === 'Champion') {
      const keywords = kw[c.id] || [];
      const rampAbilities = championRampPatch[c.id] || [];
      const recall = recallPatch[c.id] || 0;
      const ominous = ominousPatch[c.id] || false;
      let abilities = c.abilities || [];
      abilities = abilities.map(ab => (typeof ab === 'string' && strMap[ab]) ? strMap[ab] : ab);
      for (const k of keywords) {
        if (!abilities.some(x => typeof x === 'string' && x === k)) abilities.push(k);
      }
      for (const ra of rampAbilities) {
        abilities.push(ra);
      }
      if (recall > 0 && !abilities.some(x => typeof x === 'string' && /^recall/i.test(x))) abilities.push('Recall ' + recall);
      if (ominous && !abilities.some(x => typeof x === 'string' && /^ominous/i.test(x))) abilities.push('Ominous');
      if (abilities !== c.abilities || keywords.length > 0 || rampAbilities.length > 0 || recall > 0 || ominous) {
        c = {...c, abilities};
        if (recall > 0) c.recallCharges = recall;
      }
      if (ominous) {
        c = {...c, faceDownCost: c.faceDownCost || {generic: 2}, flipTrigger: c.flipTrigger || 'END_OF_TURN'};
      }
    }
    if (c.type === 'Omen') {
      c = {...c, faceDownCost: c.faceDownCost || {generic: 2}, flipTrigger: c.flipTrigger || 'END_OF_TURN'};
    }
    if (rarityOverride[c.id]) return {...c, rarity: rarityOverride[c.id]};
    if (c.rarity === 'Mythic' || c.id >= 1000 || (c.id >= 485 && c.id <= 581)) return c;
    let rarity = 'Common';
    if (c.type === 'Champion') {
      if (c.abilities && c.abilities.length > 0) {
        const statics = c.abilities.filter(x => typeof x === 'object' && x.trigger === 'static').length;
        if (statics >= 2 && getCost(c.cost) >= 5) rarity = 'Rare';
        else if (statics >= 1 || c.abilities.some(x => typeof x === 'object' && x.trigger !== 'static')) rarity = 'Uncommon';
        else if (getCost(c.cost) >= 3) rarity = 'Uncommon';
      } else if (getCost(c.cost) >= 3) {
        rarity = 'Uncommon';
      }
    } else {
      if (c.abilities && c.abilities.length > 0) rarity = 'Uncommon';
      if (rareSpells.has(c.id)) rarity = 'Rare';
    }
    return {...c, rarity};
  });

  // v0.1050 rebalance (after rarity freeze: rarity/type/identity preserved).
  cards = cards.map(c => {
    if (Object.prototype.hasOwnProperty.call(rebalancePatch, c.id)) {
      const p = rebalancePatch[c.id];
      c = {...c};
      if (p.power !== undefined) c.power = p.power;
      if (p.toughness !== undefined) c.toughness = p.toughness;
      if (p.abilities) c.abilities = p.abilities;
    }
    return c;
  });

  // Authored text/flavor (display-only; engine uses `abilities`).
  cards = cards.map(c => {
    if (Object.prototype.hasOwnProperty.call(textPatch, c.id)) c = {...c, text: textPatch[c.id]};
    if (Object.prototype.hasOwnProperty.call(flavorPatch, c.id)) c = {...c, flavor: flavorPatch[c.id]};
    return c;
  });

  return cards;
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------
const FILES = {
  build:     path.join(ROOT, 'card_database.json'),
  master:    path.join(ROOT, 'card_database.master.json'),
  backup:    path.join(ROOT, 'card_database.backup.json'),
  tentative: path.join(ROOT, 'card_database.tentative.json')
};

const SCHEMA_DEF  = path.join(ROOT, 'schema_definitions.json');
const CARD_SCHEMA_JS = path.join(ROOT, 'shared', 'card-schema.js');

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function writeRaw(p, str) {
  fs.writeFileSync(p, str, 'utf8');
}

// Regenerate shared/card-schema.js from schema_definitions.json (single source of truth).
function regenerateCardSchema() {
  const schema = readJSON(SCHEMA_DEF);
  const body = '/* GENERATED FILE - DO NOT EDIT. Regenerated by build-cards.js from schema_definitions.json. */\n' +
    '(function(root, factory) {\n' +
    '  if (typeof module !== \'undefined\' && module.exports) {\n' +
    '    module.exports = factory();\n' +
    '  } else {\n' +
    '    root.CARD_SCHEMA = factory();\n' +
    '  }\n' +
    '})(typeof self !== \'undefined\' ? self : this, function() {\n' +
    '  var D = ' + JSON.stringify(schema) + ';\n' +
    '  return {\n' +
    '    VERSION: D.version,\n' +
    '    TYPES: D.types,\n' +
    '    TRIGGERS: D.triggers,\n' +
    '    TRIGGER_PHASES: D.triggerPhases,\n' +
    '    EFFECTS: D.effects,\n' +
    '    FIELDS: D.fields\n' +
    '  };\n' +
    '});\n';
  writeRaw(CARD_SCHEMA_JS, body);
  console.log('  regenerated shared/card-schema.js from schema_definitions.json');
  return schema;
}

// Validate every card against schema_definitions.json. Returns array of problems.
function validateCardsAgainstSchema(cards, schema) {
  const problems = [];
  const typeEnum = new Set(schema.typeEnum || []);
  const rarityEnum = new Set(schema.rarities || []);
  const colorEnum = new Set(schema.colors || schema.factions || []);
  const effectSet = new Set(schema.effects || []);
  const triggerSet = new Set(schema.triggers || []);
  for (const c of cards) {
    if (!typeEnum.has(c.type)) problems.push(`id ${c.id} (${c.name}): unknown type "${c.type}"`);
    if (c.rarity && !rarityEnum.has(c.rarity)) problems.push(`id ${c.id} (${c.name}): unknown rarity "${c.rarity}"`);
    if (!colorEnum.has(c.color)) problems.push(`id ${c.id} (${c.name}): unknown color "${c.color}"`);
    for (const ab of (c.abilities || [])) {
      if (ab && typeof ab === 'object') {
        if (ab.effect && !effectSet.has(ab.effect)) problems.push(`id ${c.id} (${c.name}): unknown effect "${ab.effect}"`);
        if (ab.trigger && !triggerSet.has(ab.trigger)) problems.push(`id ${c.id} (${c.name}): unknown trigger "${ab.trigger}"`);
      }
    }
  }
  return problems;
}

function summarize(cards, label) {
  const byType = {};
  const byRarity = {};
  for (const c of cards) {
    byType[c.type] = (byType[c.type] || 0) + 1;
    byRarity[c.rarity] = (byRarity[c.rarity] || 0) + 1;
  }
  console.log(`  ${label}: ${cards.length} cards`);
  console.log(`    by type:   ${Object.entries(byType).map(([k,v]) => `${k}=${v}`).join(', ')}`);
  console.log(`    by rarity: ${Object.entries(byRarity).map(([k,v]) => `${k}=${v}`).join(', ')}`);
}

function buildCards() {
  const cardsRaw = readJSON(path.join(ROOT, 'cards.json'));
  const cards = transformCards(cardsRaw);
  writeJSON(FILES.build, cards);
  return cards;
}

function ensureSeed(cards) {
  // Seed master/backup/tentative from the current build ONLY if they don't exist yet.
  let seeded = false;
  for (const key of ['master', 'backup', 'tentative']) {
    if (!fs.existsSync(FILES[key])) {
      writeJSON(FILES[key], cards);
      console.log(`  seeded ${key} (${path.basename(FILES[key])}) from current build`);
      seeded = true;
    }
  }
  return seeded;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
const cmd = process.argv[2] || 'build';

switch (cmd) {
  case 'build':
  case 'default': {
    console.log('Building card_database.json from cards.json + transformCards()...');
    const cards = buildCards();
    summarize(cards, 'build');
    const schema = regenerateCardSchema();
    const problems = validateCardsAgainstSchema(cards, schema);
    if (problems.length) {
      console.log(`  SCHEMA VIOLATIONS (${problems.length}):`);
      problems.forEach(p => console.log('    ' + p));
    } else {
      console.log('  schema validation: OK (0 violations)');
    }
    ensureSeed(cards);
    break;
  }
  case 'init': {
    console.log('(Re)seeding master/backup/tentative from current build...');
    const cards = buildCards();
    writeJSON(FILES.master, cards);
    writeJSON(FILES.backup, cards);
    writeJSON(FILES.tentative, cards);
    summarize(cards, 'seeded');
    regenerateCardSchema();
    break;
  }
  case 'promote': {
    if (!fs.existsSync(FILES.tentative)) {
      console.error('ERROR: card_database.tentative.json does not exist. Run build first.');
      process.exit(1);
    }
    const tentative = readJSON(FILES.tentative);
    if (fs.existsSync(FILES.master)) fs.copyFileSync(FILES.master, FILES.backup);
    writeJSON(FILES.master, tentative);
    writeJSON(FILES.backup, tentative);
    summarize(tentative, 'promoted to master');
    break;
  }
  case 'verify': {
    const build = readJSON(FILES.build);
    const master = readJSON(FILES.master);
    const t = readJSON(FILES.tentative);
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    console.log('Verification:');
    console.log(`  build     vs master    : ${eq(build, master) ? 'IDENTICAL' : 'DIFFERS'}`);
    console.log(`  build     vs tentative : ${eq(build, t) ? 'IDENTICAL' : 'DIFFERS'}`);
    console.log(`  master    vs backup    : ${eq(master, readJSON(FILES.backup)) ? 'IDENTICAL' : 'DIFFERS'}`);
    if (!eq(build, master)) {
      const buildIds = new Set(build.map(c => c.id));
      const masterIds = new Set(master.map(c => c.id));
      const added = [...buildIds].filter(id => !masterIds.has(id));
      const removed = [...masterIds].filter(id => !buildIds.has(id));
      if (added.length) console.log(`  added in build:   ${added.join(', ')}`);
      if (removed.length) console.log(`  missing in build: ${removed.join(', ')}`);
    }
    const schema = readJSON(SCHEMA_DEF);
    const problems = validateCardsAgainstSchema(build, schema);
    console.log(`  schema validation: ${problems.length ? problems.length + ' VIOLATIONS' : 'OK (0 violations)'}`);
    problems.forEach(p => console.log('    ' + p));
    break;
  }
  default:
    console.error(`Unknown command: ${cmd}`);
    console.error('Usage: node build-cards.js [build|init|promote|verify]');
    process.exit(1);
}

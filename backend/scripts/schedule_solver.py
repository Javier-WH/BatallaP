#!/usr/bin/env python3
"""
schedule_solver.py — CP-SAT solver for school schedule generation.

Receives a JSON problem on stdin, returns a JSON solution on stdout.

Problem format:
{
  "blockSize": 2,
  "avoidLastMorningFirstAfternoon": true,
  "days": ["Lunes", "Martes", ...],
  "blocks": [
    { "id": "m1_m2", "day": "Lunes", "section": "manana", "periodIds": ["m1","m2"], "order": 0 },
    ...
  ],
  "sections": [
    {
      "id": 1,
      "periodGradeId": 10,
      "subjects": [
        {
          "subjectId": 5,
          "weeklyBlocks": 2,
          "allowConsecutiveBlocks": 2,  // 0=off, 1=try, 2=mandatory
          "maxHoursPerDay": null,
          "subjectGroupId": null,
          "teacherId": 3,
          "difficulty": "medium"  // "heavy" | "medium" | "light", optional, default "medium"
        }
      ]
    }
  ],
  "teacherBusy": [
    { "teacherId": 3, "day": "Lunes", "blockId": "m1_m2" }
  ],
  "groupSubjects": [
    // Each entry: a subjectGroupId that must be placed in the SAME block
    // across all sections of the same grade
    { "subjectGroupId": 7, "periodGradeId": 10, "subjectIds": [5, 6, 8] }
  ],
  // Hard-sync same-grade groups: a block+day is only a valid group slot if EVERY
  // section can place EVERY group subject there (default true)
  "syncGroupSubjects": true,

  // ── Class-schedule compactness (NEW) ──
  // A section's day is scored on: (a) forming as few separate runs of blocks as
  // possible (ideally one unbroken run), (b) not being "thin" (a lone block or two
  // when the section is in that day at all), (c) never splitting into a morning
  // visit and a separate afternoon visit. All three are captured by the same
  // run-count + thin-day scoring below; there is no separate toggle for each.
  "minConsolidatedBlocksPerDay": 2,   // below this, a day that IS used is penalized
  "dayCompactnessWeight": 200,        // penalty per extra run (beyond 1) in a section's day
  "thinDayWeight": 150,               // penalty per block short of minConsolidatedBlocksPerDay
  "shortVisitWeight": 300,            // penalty per run shorter than minConsolidatedBlocksPerDay
                                      // (a lone-block visit doesn't justify the trip)

  // ── Subject difficulty (NEW) ──
  // Add "difficulty": "heavy" | "medium" | "light" (default "medium") to any
  // subject entry under sections[].subjects[]. Used for two soft preferences:
  "heavyBackToBackWeight": 80,        // penalty when 2 heavy subjects land in adjacent blocks, same day/turn
  "heavyLateBlockWeight": 40,         // penalty when a heavy subject lands in a "late" block
  "heavyAvoidLastNMorning": 1,        // how many trailing morning blocks count as "late"
  "heavyAvoidLastNAfternoon": 1,      // how many trailing afternoon blocks count as "late"
  "heavyPositionWeight": 20,          // gradient: penalty per position step for heavy (later = worse)
  "lightPositionBonus": 10,           // gradient: bonus per position step for light (later = better)

  // ── Same-day duplication (NEW) ──
  // A subject seen twice in one day is only acceptable as a consecutive run
  // ("one longer session") or as a last resort. Mode 0: any same-day repeat is
  // penalized. Mode 1: only a non-adjacent repeat is penalized (a run still
  // counts as one session). Mode 2: handled by the run constraints.
  "sameDaySubjectWeight": 800,        // below under-placement (1000): doubling still beats leaving hours out

  // ── Forced slot exception (NEW) ──
  // Force a subject to strongly prefer the very first morning block, or the very
  // last afternoon block, each day it's offered. Soft (very high weight, editable,
  // breakable only if nothing else fits).
  "forcedSlotSubjects": [
    {
      "sectionId": 1,               // optional; omit/null to apply to this subjectId in every section that offers it
      "subjectId": 5,
      "position": "first_morning",  // or "last_afternoon"
      "weight": 5000                // optional; falls back to forcedSlotDefaultWeight
    }
  ],
  "forcedSlotDefaultWeight": 5000
}

Solution format:
{
  "success": true,
  "placed": [
    { "sectionId": 1, "subjectId": 5, "teacherId": 3, "day": "Lunes", "blockId": "m1_m2", "periodIds": ["m1","m2"], "isGroupSubject": false }
  ],
  "unplaced": [
    { "sectionId": 1, "subjectId": 5, "reason": "No space" }
  ],
  "stats": { "filledBlocks": 10, "totalBlocks": 50 }
}
"""

import sys
import json
from ortools.sat.python import cp_model


def main():
    raw = sys.stdin.read()
    problem = json.loads(raw)

    blockSize = problem.get("blockSize", 1)
    avoid_gap = problem.get("avoidLastMorningFirstAfternoon", False)
    print(f"[solver] avoidLastMorningFirstAfternoon = {avoid_gap}", file=sys.stderr)
    days = problem.get("days", ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"])
    blocks = problem.get("blocks", [])
    sections = problem.get("sections", [])
    teacher_busy = problem.get("teacherBusy", [])
    teacher_preferred = problem.get("teacherPreferred", [])
    group_subjects = problem.get("groupSubjects", [])
    cross_grade_links = problem.get("crossGradeLinks", [])
    # Hard-sync: when enabled, group subjects of the same grade can ONLY be placed
    # in block+day slots where EVERY section can place EVERY group subject
    # (i.e. all group teachers are free). Configurable via the exceptions panel.
    sync_group_subjects = problem.get("syncGroupSubjects", True)
    print(f"[solver] syncGroupSubjects={sync_group_subjects}", file=sys.stderr)

    # ── New: class-schedule compactness config ──
    min_consolidated_blocks = problem.get("minConsolidatedBlocksPerDay", 2)
    day_compactness_weight = problem.get("dayCompactnessWeight", 200)
    thin_day_weight = problem.get("thinDayWeight", 150)

    # ── New: subject difficulty config ──
    heavy_b2b_weight = problem.get("heavyBackToBackWeight", 80)
    heavy_late_weight = problem.get("heavyLateBlockWeight", 40)
    heavy_avoid_last_n_morning = problem.get("heavyAvoidLastNMorning", 1)
    heavy_avoid_last_n_afternoon = problem.get("heavyAvoidLastNAfternoon", 1)
    # Positional gradient: each step later in the turn costs this much for a
    # heavy subject; a light subject earns a bonus per step (pushes swap pressure).
    heavy_position_weight = problem.get("heavyPositionWeight", 20)
    light_position_bonus = problem.get("lightPositionBonus", 10)

    # Same-day duplication: a subject seen twice in one day is only acceptable
    # as a consecutive run ("one longer session") or as a last resort. Weight is
    # kept below under-placement (1000) so doubling still beats leaving hours out.
    same_day_subject_weight = problem.get("sameDaySubjectWeight", 800)

    # Short visit: a run shorter than minConsolidatedBlocksPerDay doesn't justify
    # the trip (e.g. one lone morning block before an afternoon session).
    short_visit_weight = problem.get("shortVisitWeight", 300)

    # ── New: forced slot exceptions ──
    forced_slot_subjects = problem.get("forcedSlotSubjects", [])
    forced_slot_default_weight = problem.get("forcedSlotDefaultWeight", 5000)

    # ── Index blocks ──
    # blocks: list of { id, day, section(manana/tarde), periodIds, order }
    # Group blocks by day and by section-type for consecutive block detection
    blocks_by_day = {}
    blocks_by_day_section = {}
    block_index = {}  # id -> block
    for b in blocks:
        block_index[b["id"]] = b
        day = b["day"]
        if day not in blocks_by_day:
            blocks_by_day[day] = []
        blocks_by_day[day].append(b)
        key = (day, b["section"])
        if key not in blocks_by_day_section:
            blocks_by_day_section[key] = []
        blocks_by_day_section[key].append(b)

    # Sort blocks within each day+section by order
    for key in blocks_by_day_section:
        blocks_by_day_section[key].sort(key=lambda b: b["order"])

    # ── Compute a reliable whole-day chronological order ──
    # "order" is only unique WITHIN a turn (morning blocks are 0,1,2,... and
    # afternoon blocks restart at 0,1,2,...), so falling back to "order" alone
    # when "globalOrder" is missing would interleave morning and afternoon
    # blocks by tied sort keys (e.g. [m0, t0, m1, t1] instead of [m0, m1, t0]),
    # making a lone morning block plus a lone afternoon block look like one
    # adjacent, compact run to the compactness/short-run scoring below. We
    # always compute the whole-day order ourselves (morning before afternoon,
    # by "order" within each turn) instead of trusting the supplied field.
    _TURN_RANK = {"manana": 0, "tarde": 1}
    computed_global_order = {}  # (day, block_id) -> int
    for day, day_blocks_raw in blocks_by_day.items():
        ordered = sorted(day_blocks_raw, key=lambda b: (_TURN_RANK.get(b["section"], 2), b["order"]))
        for i, b in enumerate(ordered):
            computed_global_order[(day, b["id"])] = i

    def global_order(b):
        return computed_global_order[(b["day"], b["id"])]

    # ── Identify last morning block and first afternoon block per day ──
    last_morning_block = {}  # day -> block_id
    first_afternoon_block = {}  # day -> block_id
    first_morning_block = {}  # day -> block_id
    last_afternoon_block = {}  # day -> block_id
    # "Late" blocks (NEW): trailing blocks of each turn, flagged for heavy-subject avoidance.
    late_block_ids = set()  # block ids considered unfavorable for heavy subjects
    for day in days:
        manana = sorted(blocks_by_day_section.get((day, "manana"), []), key=lambda b: b["order"])
        tarde = sorted(blocks_by_day_section.get((day, "tarde"), []), key=lambda b: b["order"])
        if manana:
            last_morning_block[day] = manana[-1]["id"]
            first_morning_block[day] = manana[0]["id"]
            for b in manana[-heavy_avoid_last_n_morning:] if heavy_avoid_last_n_morning > 0 else []:
                late_block_ids.add((b["id"], day))
        if tarde:
            first_afternoon_block[day] = tarde[0]["id"]
            last_afternoon_block[day] = tarde[-1]["id"]
            for b in tarde[-heavy_avoid_last_n_afternoon:] if heavy_avoid_last_n_afternoon > 0 else []:
                late_block_ids.add((b["id"], day))

    # Debug: log avoid_gap and block boundaries
    print(f"[solver] avoid_gap={avoid_gap}", file=sys.stderr)
    for day in days:
        lm = last_morning_block.get(day)
        fa = first_afternoon_block.get(day)
        if lm and fa:
            print(f"[solver]   {day}: last_morning={lm}, first_afternoon={fa}", file=sys.stderr)

    # ── Build teacher busy and preferred sets ──
    busy_set = set()
    for tb in teacher_busy:
        busy_set.add((tb["teacherId"], tb["day"], tb["blockId"]))

    preferred_set = set()
    for tp in teacher_preferred:
        preferred_set.add((tp["teacherId"], tp["day"], tp["blockId"]))

    # ── Build group subject map ──
    # For each (periodGradeId, subjectGroupId), we need all sections of that grade
    # to place their group subject in the same block+day.
    group_map = {}  # (periodGradeId, subjectGroupId) -> { subjectIds, sectionSubjectMap: sectionId -> subjectId }
    for gs in group_subjects:
        key = (gs["periodGradeId"], gs["subjectGroupId"])
        group_map[key] = gs

    # Build section -> periodGradeId map
    section_pg = {}
    for sec in sections:
        section_pg[sec["id"]] = sec["periodGradeId"]

    # ── Build cross-grade link map ──
    # Each link groups (subjectId, periodGradeId) pairs that must share the same block+day.
    # Build a set of (periodGradeId, subjectId) pairs that are part of any link,
    # plus a map to the link id for teacher-conflict exemption grouping.
    linked_pairs = set()
    pair_to_link = {}
    for link in cross_grade_links:
        for item in link.get("items", []):
            pair = (item["periodGradeId"], item["subjectId"])
            linked_pairs.add(pair)
            pair_to_link[pair] = link["id"]

    # ── New: subject difficulty lookup ──
    # (sectionId, subjectId) -> "heavy" | "medium" | "light"
    subject_difficulty = {}
    for sec in sections:
        for sub in sec["subjects"]:
            subject_difficulty[(sec["id"], sub["subjectId"])] = sub.get("difficulty", "medium")

    # ── Build the CP-SAT model ──
    model = cp_model.CpModel()

    # Decision variables: x[(sectionId, subjectId, blockId, day)] = BoolVar
    x = {}  # (sectionId, subjectId, blockId, day) -> BoolVar
    subject_vars = {}  # (sectionId, subjectId) -> list of (block, var)

    for sec in sections:
        sid = sec["id"]
        for sub in sec["subjects"]:
            subj_id = sub["subjectId"]
            weekly_blocks = sub["weeklyBlocks"]
            if weekly_blocks <= 0:
                continue
            teacher_id = sub.get("teacherId")
            if teacher_id is None:
                continue  # no teacher, will be unplaced

            var_list = []
            for b in blocks:
                day = b["day"]
                # Skip if teacher is busy
                if (teacher_id, day, b["id"]) in busy_set:
                    continue
                v = model.NewBoolVar(f"x_{sid}_{subj_id}_{b['id']}_{day}")
                x[(sid, subj_id, b["id"], day)] = v
                var_list.append((b, v))
            subject_vars[(sid, subj_id)] = var_list

    # ── Constraint 1: Each subject placed at most weeklyBlocks times (soft: penalize under-placement) ──
    under_place_penalties = []
    for sec in sections:
        sid = sec["id"]
        for sub in sec["subjects"]:
            subj_id = sub["subjectId"]
            weekly_blocks = sub["weeklyBlocks"]
            if weekly_blocks <= 0:
                continue
            if (sid, subj_id) not in subject_vars:
                continue
            var_list = subject_vars[(sid, subj_id)]
            if len(var_list) == 0:
                continue
            # Hard constraint: at most weeklyBlocks
            model.Add(sum(v for (_, v) in var_list) <= weekly_blocks)
            # Soft: penalize placing fewer than weeklyBlocks
            placed_sum = sum(v for (_, v) in var_list)
            shortfall = model.NewIntVar(0, weekly_blocks, f"shortfall_{sid}_{subj_id}")
            model.Add(shortfall >= weekly_blocks - placed_sum)
            under_place_penalties.append(shortfall)

    # ── Constraint 2: Subject conflicts within a block ──
    # - Non-group subjects: at most 1 per block (mutually exclusive)
    # - Group subjects of the SAME group: CAN coexist (students split between rooms)
    # - Group subjects of DIFFERENT groups: mutually exclusive
    # - Group and non-group: mutually exclusive
    for sec in sections:
        sid = sec["id"]
        for b in blocks:
            non_group_vars = []
            group_vars_by_sg = {}  # sgId -> list of vars
            for sub in sec["subjects"]:
                subj_id = sub["subjectId"]
                key = (sid, subj_id, b["id"], b["day"])
                if key in x:
                    sg_id = sub.get("subjectGroupId")
                    if sg_id is None:
                        non_group_vars.append(x[key])
                    else:
                        if sg_id not in group_vars_by_sg:
                            group_vars_by_sg[sg_id] = []
                        group_vars_by_sg[sg_id].append(x[key])

            # Non-group subjects: at most 1
            if len(non_group_vars) > 1:
                model.Add(sum(non_group_vars) <= 1)

            # Create "group_occupied" var for each group: 1 if any subject of that group is placed
            group_occupied = []
            for sg_id, gvars in group_vars_by_sg.items():
                if not gvars:
                    continue
                occ = model.NewBoolVar(f"gocc_{sid}_{b['id']}_{b['day']}_{sg_id}")
                model.AddMaxEquality(occ, gvars)
                group_occupied.append(occ)

            # Non-group + group-occupied: at most 1 total
            # (either a non-group subject, or one group's subjects, but not both)
            all_conflicting = non_group_vars + group_occupied
            if len(all_conflicting) > 1:
                model.Add(sum(all_conflicting) <= 1)

    # ── Constraint 3: Teacher conflicts — no teacher in two places at same block+day ──
    # Exemptions (same teacher MAY appear in several sections at once):
    #   - Group subjects within the SAME grade (periodGradeId): the teacher runs the
    #     group's parallel sessions across sections of that grade simultaneously.
    #   - Subjects in the SAME cross-grade link: manually configured to share the
    #     same block across different grades.
    # A group subject in grade X and a group subject in grade Y (not linked) MUST
    # conflict on the same teacher — the teacher cannot be in two grades at once.
    #
    # Model: for each (teacher, block, day) build "coexistence components" via
    # union-find over two kinds of merge keys:
    #   (periodGradeId, subjectGroupId) — same grade+group share the group slot anyway
    #   link id                          — linked subjects share the link slot anyway
    # Each component collapses to a single occupancy var (OR of its vars); the sum of
    # regular vars + occupancy vars must be <= 1.
    teacher_slot_regular = {}  # (teacherId, blockId, day) -> [var]
    teacher_slot_exempt = {}   # (teacherId, blockId, day) -> [(var, pg_id, sg_id, link_id)]
    for sec in sections:
        sid = sec["id"]
        pg_id = sec["periodGradeId"]
        for sub in sec["subjects"]:
            subj_id = sub["subjectId"]
            teacher_id = sub.get("teacherId")
            if teacher_id is None:
                continue
            sg_id = sub.get("subjectGroupId")
            link_id = pair_to_link.get((pg_id, subj_id))
            for (b, v) in subject_vars.get((sid, subj_id), []):
                key = (teacher_id, b["id"], b["day"])
                if sg_id is None and link_id is None:
                    teacher_slot_regular.setdefault(key, []).append(v)
                else:
                    teacher_slot_exempt.setdefault(key, []).append((v, pg_id, sg_id, link_id))

    for (tid, bid, day), exempt in teacher_slot_exempt.items():
        # Union-find over coexistence keys: (pg, sg) for group subjects and
        # ('link', link_id) for linked subjects. A linked group subject carries both
        # keys, so it merges with its same-grade group peers and its linked grades.
        n = len(exempt)
        parent = list(range(n))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        def union(i, j):
            parent[find(i)] = find(j)

        key_to_idx = {}
        for i, (_v, pg, sg, lk) in enumerate(exempt):
            merge_keys = []
            if sg is not None:
                merge_keys.append(("pg", pg, sg))
            if lk is not None:
                merge_keys.append(("link", lk))
            for k in merge_keys:
                if k in key_to_idx:
                    union(i, key_to_idx[k])
                else:
                    key_to_idx[k] = i

        comp_vars = {}  # root -> [var]
        for i, (v, _pg, _sg, _lk) in enumerate(exempt):
            comp_vars.setdefault(find(i), []).append(v)

        occ_vars = []
        for root, vlist in comp_vars.items():
            occ = model.NewBoolVar(f"tocc_{tid}_{bid}_{day}_{root}")
            model.AddMaxEquality(occ, vlist)
            occ_vars.append(occ)

        regular = teacher_slot_regular.get((tid, bid, day), [])
        all_units = regular + occ_vars
        if len(all_units) > 1:
            model.Add(sum(all_units) <= 1)

    # Slots where the teacher only has regular (non-exempt) subjects
    for (tid, bid, day), vars_list in teacher_slot_regular.items():
        if (tid, bid, day) in teacher_slot_exempt:
            continue  # already handled above
        if len(vars_list) > 1:
            model.Add(sum(vars_list) <= 1)

    # ── Constraint 4: maxHoursPerDay ──
    # Count blocks per day for each subject in each section
    for sec in sections:
        sid = sec["id"]
        for sub in sec["subjects"]:
            subj_id = sub["subjectId"]
            max_hours = sub.get("maxHoursPerDay")
            if max_hours is None:
                continue
            # maxBlocksPerDay = max_hours // blockSize
            max_blocks = max_hours // blockSize
            for day in days:
                day_vars = []
                for (b, v) in subject_vars.get((sid, subj_id), []):
                    if b["day"] == day:
                        day_vars.append(v)
                if len(day_vars) > max_blocks:
                    model.Add(sum(day_vars) <= max_blocks)

    # ── Constraint 5: avoid_last_morning_first_afternoon ──
    # If a section has a subject in the last morning block, it cannot have
    # any subject in the first afternoon block that same day.
    if avoid_gap:
        for sec in sections:
            sid = sec["id"]
            for day in days:
                lm = last_morning_block.get(day)
                fa = first_afternoon_block.get(day)
                if lm is None or fa is None:
                    continue
                # Sum of all subjects in last morning block
                lm_vars = []
                fa_vars = []
                for sub in sec["subjects"]:
                    subj_id = sub["subjectId"]
                    k1 = (sid, subj_id, lm, day)
                    k2 = (sid, subj_id, fa, day)
                    if k1 in x:
                        lm_vars.append(x[k1])
                    if k2 in x:
                        fa_vars.append(x[k2])
                if lm_vars and fa_vars:
                    # If any lm var is 1, all fa vars must be 0
                    # Use a boolean "lm_occupied" since lm_sum can be > 1 (group subjects)
                    lm_occupied = model.NewBoolVar(f"lmocc_{sid}_{day}")
                    model.AddMaxEquality(lm_occupied, lm_vars)
                    # fa_sum <= len(fa_vars) * (1 - lm_occupied)
                    model.Add(sum(fa_vars) <= len(fa_vars) * (1 - lm_occupied))

    # ── Constraint 6: All group subjects of the same group must be in the SAME block+day ──
    # Both sections have BOTH subjects. Students split between rooms.
    # So if Artes Gráficas is in block X on day Y for section A,
    # then Redacción must also be in block X on day Y for section A,
    # AND Artes must be in block X on day Y for section B,
    # AND Redacción must be in block X on day Y for section B.
    #
    # Implementation: for each (pgId, sgId, blockId, day), create a single "group slot" bool.
    # If slot=1, EVERY section must place ALL its group subjects in that block.
    # If slot=0, no section places any group subject in that block.
    group_slot_vars = {}  # (pgId, sgId, blockId, day) -> BoolVar
    if sync_group_subjects:
        for gs in group_subjects:
            pg_id = gs["periodGradeId"]
            sg_id = gs["subjectGroupId"]
            subject_ids = gs["subjectIds"]
            for b in blocks:
                # Check if any section of this grade has vars for this group in this block
                has_vars = False
                for sec in sections:
                    if sec["periodGradeId"] != pg_id:
                        continue
                    sid = sec["id"]
                    for subj_id in subject_ids:
                        if (sid, subj_id, b["id"], b["day"]) in x:
                            has_vars = True
                            break
                    if has_vars:
                        break
                if not has_vars:
                    continue

                # Create the group slot variable
                gs_var = model.NewBoolVar(f"gslot_{pg_id}_{sg_id}_{b['id']}_{b['day']}")
                group_slot_vars[(pg_id, sg_id, b["id"], b["day"])] = gs_var

                # For each section of this grade: EACH group subject var must equal the group slot
                # (if slot=1, all group subjects are placed; if slot=0, none are placed)
                complete = True
                for sec in sections:
                    if sec["periodGradeId"] != pg_id:
                        continue
                    sid = sec["id"]
                    for subj_id in subject_ids:
                        if (sid, subj_id) not in subject_vars:
                            continue  # this section does not offer this group subject
                        k = (sid, subj_id, b["id"], b["day"])
                        if k in x:
                            model.Add(x[k] == gs_var)
                        else:
                            # A required placement is impossible in this block (e.g. the
                            # teacher is busy): the whole group cannot use this slot.
                            complete = False
                if not complete:
                    model.Add(gs_var == 0)

    # Debug: log group slot var counts
    group_slot_counts = {}
    for key in group_slot_vars:
        pg_id, sg_id, block_id, day = key
        gk = (pg_id, sg_id)
        group_slot_counts[gk] = group_slot_counts.get(gk, 0) + 1
    for gk, count in group_slot_counts.items():
        print(f"[solver] Group slot pg={gk[0]} sg={gk[1]}: {count} block-days available", file=sys.stderr)

    # ── Constraint 6b: Cross-grade links — all linked (subject, grade) pairs must share the SAME block+day ──
    # Manually configured links allow subjects from different grades/sections to be
    # scheduled in the same block+day. Each link creates a single "link slot" bool per
    # (blockId, day); every linked subject var across all sections must equal that slot.
    link_slot_vars = {}  # (linkId, blockId, day) -> BoolVar
    for link in cross_grade_links:
        link_id = link["id"]
        items = link.get("items", [])
        for b in blocks:
            # Check if any section has vars for any linked subject in this block+day
            has_vars = False
            for item in items:
                for sec in sections:
                    if sec["periodGradeId"] != item["periodGradeId"]:
                        continue
                    sid = sec["id"]
                    if (sid, item["subjectId"], b["id"], b["day"]) in x:
                        has_vars = True
                        break
                if has_vars:
                    break
            if not has_vars:
                continue

            ls_var = model.NewBoolVar(f"lslot_{link_id}_{b['id']}_{b['day']}")
            link_slot_vars[(link_id, b["id"], b["day"])] = ls_var

            # Each linked subject var across all matching sections must equal the link slot
            complete = True
            for item in items:
                for sec in sections:
                    if sec["periodGradeId"] != item["periodGradeId"]:
                        continue
                    sid = sec["id"]
                    if (sid, item["subjectId"]) not in subject_vars:
                        continue
                    k = (sid, item["subjectId"], b["id"], b["day"])
                    if k in x:
                        model.Add(x[k] == ls_var)
                    else:
                        # A required placement is impossible in this block (e.g. the
                        # teacher is busy): the whole link cannot use this slot.
                        complete = False
            if not complete:
                model.Add(ls_var == 0)

    # Debug: log link slot var counts
    link_slot_counts = {}
    for key in link_slot_vars:
        link_id, block_id, day = key
        link_slot_counts[link_id] = link_slot_counts.get(link_id, 0) + 1
    for link_id, count in link_slot_counts.items():
        print(f"[solver] Cross-grade link {link_id}: {count} block-days available", file=sys.stderr)

    # ── Constraint 7: allowConsecutiveBlocks (mode 2 = mandatory) ──
    # If mode 2 and weeklyBlocks > 1, all blocks must be consecutive in the same day+section.
    # "Consecutive" means adjacent blocks in the same section (manana/tarde).
    # We create a "start" var for each possible start position, and enforce that
    # if start is chosen, the next (weeklyBlocks-1) blocks are also chosen.
    # Also, no non-consecutive placement is allowed.
    #
    # For mode 1 (try), we add a soft penalty for non-consecutive placements.
    # For mode 0, no constraint.

    # We'll handle this by creating "segment" variables.
    # A segment is a run of `weeklyBlocks` consecutive blocks in the same day+section.
    # For mode 2: the subject must be placed as exactly one segment (or a few segments
    #   that together sum to weeklyBlocks, but all segments must be maximal consecutive).
    # Actually, simpler: for mode 2, all placed blocks must form a single contiguous run.

    # Let's use a different approach: for mode 2, create segment vars.
    # segment[s][subj][day][section][startIdx] = BoolVar
    # If chosen, blocks[startIdx..startIdx+weeklyBlocks-1] are all placed.
    # Exactly one segment must be chosen (sum == 1, but weeklyBlocks might not divide evenly).
    # Actually weeklyBlocks is in units of blocks, so if blockSize=2 and weeklyBlocks=2,
    # the subject needs 2 blocks = 4 hours. If allowConsecutive=2, those 2 blocks must be adjacent.

    # We need weeklyBlocks to be in "block units" not "hour units".
    # Looking at the problem: weeklyBlocks is already in block units (it's the number of
    # blocks of size `blockSize` that the subject needs per week).

    # For mode 2: create segment vars, replace the general x vars with segment-based logic.
    # But this gets complex. Let's use a simpler approach:
    # For mode 2, for each subject, create "is_start" vars and "is_continuation" vars.
    # A block is a "start" if it's placed AND (it's the first block of the day+section OR
    #   the previous block is not placed for this subject).
    # A block is a "continuation" if it's placed AND the previous block is also placed.
    # For mode 2: number of starts must be exactly 1 (all blocks form one run).
    # Wait, that's too strict if weeklyBlocks > available consecutive blocks.
    # Actually for mode 2: the subject is either fully placed as one consecutive run, or not placed at all.
    # So: either sum of all vars == 0 (not placed), or sum == weeklyBlocks AND starts == 1.

    penalty_terms = []  # for mode 1 soft penalties

    for sec in sections:
        sid = sec["id"]
        for sub in sec["subjects"]:
            subj_id = sub["subjectId"]
            weekly = sub["weeklyBlocks"]
            mode = sub.get("allowConsecutiveBlocks", 0)
            if weekly <= 0 or mode == 0:
                continue
            if (sid, subj_id) not in subject_vars:
                continue

            # Group vars by (day, section_type), one entry per block of that turn —
            # NOT just the blocks where this subject has a var. A block where the
            # teacher is busy (no var in `x`) must still occupy its position in the
            # sequence (as a constant 0), otherwise the block on either side of it
            # gets treated as adjacent to what's actually two blocks apart. [FIX:
            # previously this only included subject_vars, which silently merged
            # non-adjacent blocks across a teacher-busy gap.]
            day_section_vars = {}
            for key, block_list in blocks_by_day_section.items():
                day = key[0]
                bv_list = []
                for b in block_list:
                    k = (sid, subj_id, b["id"], day)
                    v = x.get(k)
                    if v is None:
                        v = model.NewConstant(0)
                    bv_list.append((b, v))
                day_section_vars[key] = bv_list

            # Sort each group by order (already sorted in blocks_by_day_section, but
            # kept explicit here since this loop reconstructs the list each time)
            for key in day_section_vars:
                day_section_vars[key].sort(key=lambda bv: bv[0]["order"])

            if mode == 2:
                # Mandatory consecutive: all placed blocks must form exactly one run.
                # We model this as a SOFT constraint with a very high penalty,
                # so the solver can still find a solution if it's impossible.
                start_vars = []
                total_placed = []
                for key, bv_list in day_section_vars.items():
                    n = len(bv_list)
                    for i in range(n):
                        is_start = model.NewBoolVar(f"start_{sid}_{subj_id}_{key[0]}_{i}")
                        start_vars.append(is_start)
                        total_placed.append(bv_list[i][1])

                        prev_not_placed = model.NewBoolVar(f"prevnp_{sid}_{subj_id}_{key[0]}_{i}")
                        if i == 0:
                            model.Add(prev_not_placed == 1)
                        else:
                            prev_var = bv_list[i - 1][1]
                            model.Add(prev_not_placed + prev_var <= 1)
                            model.Add(prev_not_placed >= 1 - prev_var)

                        model.Add(is_start <= bv_list[i][1])
                        model.Add(is_start <= prev_not_placed)
                        model.Add(is_start >= bv_list[i][1] + prev_not_placed - 1)

                total_sum = sum(total_placed) if total_placed else None
                if total_sum is not None and start_vars:
                    starts_sum = sum(start_vars)
                    # Penalize having more than 1 start (violation of mandatory consecutive)
                    # If total_sum > 0 and starts_sum > 1, that's a violation
                    excess = model.NewIntVar(0, len(start_vars), f"m2excess_{sid}_{subj_id}")
                    model.Add(excess >= starts_sum - 1)
                    # Also penalize starts_sum == 0 when total_sum > 0 (not placed at all)
                    not_placed = model.NewBoolVar(f"m2notplaced_{sid}_{subj_id}")
                    model.Add(not_placed >= 1 - total_sum)
                    penalty_terms.append(excess * 500)  # below under-placement (1000): prefer fully placed over a clean run
                    penalty_terms.append(not_placed * 10000)  # even higher for not placing at all

            elif mode == 1:
                # Try consecutive: add penalty for each start beyond the first
                start_vars = []
                starts_by_day = {}   # day -> list of start vars (both turns)
                placed_by_day = {}   # day -> list of placement vars (both turns)
                for key, bv_list in day_section_vars.items():
                    day = key[0]
                    n = len(bv_list)
                    for i in range(n):
                        is_start = model.NewBoolVar(f"tstart_{sid}_{subj_id}_{key[0]}_{i}")
                        start_vars.append(is_start)
                        starts_by_day.setdefault(day, []).append(is_start)
                        placed_by_day.setdefault(day, []).append(bv_list[i][1])

                        prev_not_placed = model.NewBoolVar(f"tprevnp_{sid}_{subj_id}_{key[0]}_{i}")
                        if i == 0:
                            model.Add(prev_not_placed == 1)
                        else:
                            prev_var = bv_list[i - 1][1]
                            model.Add(prev_not_placed + prev_var <= 1)
                            model.Add(prev_not_placed >= 1 - prev_var)

                        model.Add(is_start <= bv_list[i][1])
                        model.Add(is_start <= prev_not_placed)
                        model.Add(is_start >= bv_list[i][1] + prev_not_placed - 1)

                if start_vars:
                    # Penalize having more than 1 start
                    # excess_starts = sum(start_vars) - 1 (if > 0)
                    excess = model.NewIntVar(0, len(start_vars), f"excess_{sid}_{subj_id}")
                    model.Add(excess >= sum(start_vars) - 1)
                    penalty_terms.append(excess * 10)  # weight 10 per extra start

                    # Same-day split: within a day, a single run counts as one
                    # session, but two separate runs (or morning+afternoon) mean
                    # the subject is seen twice that day — heavily discouraged.
                    for day, day_starts in starts_by_day.items():
                        placed_day = model.NewBoolVar(f"pday_{sid}_{subj_id}_{day}")
                        model.AddMaxEquality(placed_day, placed_by_day[day])
                        day_excess = model.NewIntVar(0, len(day_starts), f"dexcess_{sid}_{subj_id}_{day}")
                        model.Add(day_excess >= sum(day_starts) - placed_day)
                        penalty_terms.append(day_excess * same_day_subject_weight)

    # ── Soft preferences (not hard constraints) ──
    # 1. Minimize gaps WITHIN each turn (manana or tarde), not between turns
    # 2. Prefer "preferred" teacher slots
    # 3. Spread subjects across days
    # 4. Prefer filling early blocks

    gap_penalties = []       # penalize empty blocks between filled blocks within the same turn
    preferred_penalties = [] # penalize NOT using a preferred slot
    spread_penalties = []    # penalize seeing a subject twice in one day
    early_penalties = []     # penalize using high-order (late) blocks
    heavy_pos_penalties = [] # heavy subjects pay per position step (prefer early)
    light_pos_penalties = [] # light subjects earn per position step (prefer late)

    # 1. Gap penalties within each turn (manana/tarde) per section per day
    for sec in sections:
        sid = sec["id"]
        # Group blocks by (day, section_type) — each group is a turn
        day_section_blocks = {}
        for b in blocks:
            key = (b["day"], b["section"])
            if key not in day_section_blocks:
                day_section_blocks[key] = []
            day_section_blocks[key].append(b)

        for key, block_list in day_section_blocks.items():
            block_list.sort(key=lambda b: b["order"])
            n = len(block_list)
            if n < 3:
                continue

            # For each block, compute "is_occupied" = OR of all subject vars in that block
            occupied_vars = []
            for b in block_list:
                block_subject_vars = []
                for sub in sec["subjects"]:
                    subj_id = sub["subjectId"]
                    k = (sid, subj_id, b["id"], b["day"])
                    if k in x:
                        block_subject_vars.append(x[k])
                if block_subject_vars:
                    occ = model.NewBoolVar(f"occ_{sid}_{b['id']}_{b['day']}")
                    model.AddMaxEquality(occ, block_subject_vars)
                    occupied_vars.append(occ)
                else:
                    occupied_vars.append(model.NewConstant(0))

            # Penalize internal gaps: for each block i (not first, not last),
            # if block i is empty AND has occupied before AND after, it's a gap
            for i in range(1, n - 1):
                is_empty = model.NewBoolVar(f"empty_{sid}_{block_list[i]['id']}_{block_list[i]['day']}")
                model.Add(is_empty == 1 - occupied_vars[i])

                before = occupied_vars[:i]
                has_before = model.NewBoolVar(f"hb_{sid}_{block_list[i]['id']}_{block_list[i]['day']}")
                model.AddMaxEquality(has_before, before)

                after = occupied_vars[i + 1:]
                has_after = model.NewBoolVar(f"ha_{sid}_{block_list[i]['id']}_{block_list[i]['day']}")
                model.AddMaxEquality(has_after, after)

                gap = model.NewBoolVar(f"gap_{sid}_{block_list[i]['id']}_{block_list[i]['day']}")
                model.Add(gap <= is_empty)
                model.Add(gap <= has_before)
                model.Add(gap <= has_after)
                model.Add(gap >= is_empty + has_before + has_after - 2)
                gap_penalties.append(gap)

    for sec in sections:
        sid = sec["id"]
        for sub in sec["subjects"]:
            subj_id = sub["subjectId"]
            teacher_id = sub.get("teacherId")
            if teacher_id is None:
                continue
            weekly = sub["weeklyBlocks"]
            if weekly <= 0:
                continue

            var_list = subject_vars.get((sid, subj_id), [])
            if not var_list:
                continue

            # 2. Preferred slots: penalize using a non-preferred slot
            for (b, v) in var_list:
                is_pref = (teacher_id, b["day"], b["id"]) in preferred_set
                if not is_pref:
                    preferred_penalties.append(v * 1)

            # 3. Same-day duplication: a non-consecutive subject must not be seen
            # twice in one day — heavily penalized (below under-placement, so it
            # still beats leaving hours unplaced).
            mode = sub.get("allowConsecutiveBlocks", 0)
            if mode == 0 and weekly > 1:
                day_vars = {}
                for (b, v) in var_list:
                    day = b["day"]
                    if day not in day_vars:
                        day_vars[day] = []
                    day_vars[day].append(v)
                for day, dvars in day_vars.items():
                    if len(dvars) > 1:
                        day_sum = sum(dvars)
                        excess_day = model.NewIntVar(0, len(dvars), f"spread_{sid}_{subj_id}_{day}")
                        model.Add(excess_day >= day_sum - 1)
                        spread_penalties.append(excess_day * same_day_subject_weight)

            # 4. Prefer early blocks: penalize using high-order blocks (global order)
            for (b, v) in var_list:
                early_penalties.append(v * global_order(b))

            # 5. Difficulty gradient: each step later in the turn costs
            # heavy_position_weight for a heavy subject; a light subject earns
            # light_position_bonus per step (creates swap pressure — moving a
            # light subject late frees early blocks for heavy ones).
            diff = sub.get("difficulty", "medium")
            if diff == "heavy":
                for (b, v) in var_list:
                    heavy_pos_penalties.append(v * b["order"])
            elif diff == "light":
                for (b, v) in var_list:
                    light_pos_penalties.append(v * b["order"])

    # ── NEW Constraint/Preference: class-schedule compactness ──
    # For each section+day, look at the FULL day (morning + afternoon combined, in
    # true whole-day chronological order — see global_order() above) rather
    # than each turn separately.
    # Score it on:
    #   - number of separate "runs" of occupied blocks beyond the first (ideally 1
    #     run total — this alone also captures "never split morning/afternoon",
    #     since a morning visit + a separate afternoon visit is 2 runs)
    #   - how far a used day falls short of minConsolidatedBlocksPerDay (a lone
    #     block or two on an otherwise empty day is bad even if it's a single run)
    #   - runs shorter than minConsolidatedBlocksPerDay: a lone-block visit (e.g.
    #     one block in the morning plus a separate afternoon run) doesn't
    #     justify the trip
    compactness_penalties = []  # (run-count) — weight day_compactness_weight
    thin_day_penalties = []     # (shortfall)  — weight thin_day_weight
    short_run_penalties = []    # (short runs) — weight short_visit_weight

    for sec in sections:
        sid = sec["id"]
        for day in days:
            day_blocks = sorted(blocks_by_day.get(day, []), key=global_order)
            if not day_blocks:
                continue

            occ_vars = []
            for b in day_blocks:
                block_subject_vars = []
                for sub in sec["subjects"]:
                    subj_id = sub["subjectId"]
                    k = (sid, subj_id, b["id"], day)
                    if k in x:
                        block_subject_vars.append(x[k])
                if block_subject_vars:
                    occ = model.NewBoolVar(f"docc_{sid}_{b['id']}_{day}")
                    model.AddMaxEquality(occ, block_subject_vars)
                    occ_vars.append(occ)
                else:
                    occ_vars.append(model.NewConstant(0))

            n = len(occ_vars)

            # is_used: whether the section has anything at all this day
            is_used = model.NewBoolVar(f"dused_{sid}_{day}")
            model.AddMaxEquality(is_used, occ_vars)

            # Run starts: a block is a "start" if occupied and the previous block
            # (chronologically, across the whole day) was not occupied.
            start_vars = []
            for i in range(n):
                is_start = model.NewBoolVar(f"dstart_{sid}_{day}_{i}")
                if i == 0:
                    model.Add(is_start == occ_vars[0])
                else:
                    prev_not_occ = model.NewBoolVar(f"dprevnp_{sid}_{day}_{i}")
                    model.Add(prev_not_occ + occ_vars[i - 1] <= 1)
                    model.Add(prev_not_occ >= 1 - occ_vars[i - 1])
                    model.Add(is_start <= occ_vars[i])
                    model.Add(is_start <= prev_not_occ)
                    model.Add(is_start >= occ_vars[i] + prev_not_occ - 1)
                start_vars.append(is_start)

            if start_vars:
                runs_excess = model.NewIntVar(0, n, f"drunsexcess_{sid}_{day}")
                model.Add(runs_excess >= sum(start_vars) - 1)
                compactness_penalties.append(runs_excess)

                # Short runs: a run starting at i is "full length" iff all of the
                # next minConsolidatedBlocks positions are occupied. Otherwise the
                # run is a lone visit and gets penalized. A run starting with
                # fewer than `min` blocks left in the day can never be full.
                for i in range(n):
                    reach = min(i + min_consolidated_blocks, n)
                    if reach - i < min_consolidated_blocks:
                        full_len = model.NewConstant(0)
                    else:
                        full_len = model.NewBoolVar(f"dfull_{sid}_{day}_{i}")
                        model.AddMinEquality(full_len, occ_vars[i:reach])
                    short = model.NewBoolVar(f"dshort_{sid}_{day}_{i}")
                    model.Add(short <= start_vars[i])
                    model.Add(short <= 1 - full_len)
                    model.Add(short >= start_vars[i] - full_len)
                    short_run_penalties.append(short)

            # Thin day: if used, penalize shortfall against minConsolidatedBlocksPerDay.
            total_occ = sum(occ_vars)
            thin = model.NewIntVar(0, min_consolidated_blocks, f"dthin_{sid}_{day}")
            model.Add(thin >= min_consolidated_blocks - total_occ - min_consolidated_blocks * (1 - is_used))
            thin_day_penalties.append(thin)

    # ── NEW Constraint/Preference: subject difficulty ──
    # (a) Two "heavy" subjects should not land in adjacent blocks, same day/turn.
    # (b) A "heavy" subject should avoid the flagged "late" blocks of each turn.
    heavy_b2b_penalties = []
    heavy_late_penalties = []

    for sec in sections:
        sid = sec["id"]
        for key, block_list in blocks_by_day_section.items():
            day, section_type = key
            block_list_sorted = sorted(block_list, key=lambda b: b["order"])
            n = len(block_list_sorted)

            # Per-block "a heavy subject is placed here" indicator for this section.
            heavy_occ = []
            for b in block_list_sorted:
                heavy_vars = []
                for sub in sec["subjects"]:
                    subj_id = sub["subjectId"]
                    if subject_difficulty.get((sid, subj_id)) != "heavy":
                        continue
                    k = (sid, subj_id, b["id"], day)
                    if k in x:
                        heavy_vars.append(x[k])
                if heavy_vars:
                    hocc = model.NewBoolVar(f"hocc_{sid}_{b['id']}_{day}")
                    model.AddMaxEquality(hocc, heavy_vars)
                    heavy_occ.append(hocc)
                else:
                    heavy_occ.append(model.NewConstant(0))

                # Late-block penalty
                if (b["id"], day) in late_block_ids and heavy_vars:
                    heavy_late_penalties.append(hocc)

            # Back-to-back penalty: adjacent blocks in the same turn both heavy.
            for i in range(n - 1):
                both_heavy = model.NewBoolVar(f"hb2b_{sid}_{block_list_sorted[i]['id']}_{day}")
                model.Add(both_heavy <= heavy_occ[i])
                model.Add(both_heavy <= heavy_occ[i + 1])
                model.Add(both_heavy >= heavy_occ[i] + heavy_occ[i + 1] - 1)
                heavy_b2b_penalties.append(both_heavy)

    # ── NEW Constraint/Preference: forced slot exceptions ──
    # Soft, very-high-weight preference to place a subject in the first morning
    # block or the last afternoon block, each day it's offered.
    # For mandatory-consecutive subjects the target is the edge WINDOW of
    # `weeklyBlocks` blocks (a run can't fit inside a single edge block, so
    # the run that ends/starts the turn counts as on-target).
    forced_slot_penalties = []
    for entry in forced_slot_subjects:
        subj_id = entry["subjectId"]
        position = entry["position"]
        weight = entry.get("weight", forced_slot_default_weight)
        target_sections = [entry["sectionId"]] if entry.get("sectionId") is not None else [s["id"] for s in sections]

        for sid in target_sections:
            var_list = subject_vars.get((sid, subj_id))
            if not var_list:
                continue
            subj_info = next(
                (sub for s in sections if s["id"] == sid
                 for sub in s["subjects"] if sub["subjectId"] == subj_id),
                None,
            )
            run_len = 1
            if subj_info and subj_info.get("allowConsecutiveBlocks", 0) == 2:
                run_len = max(1, subj_info.get("weeklyBlocks", 1))
            target_ids_by_day = {}
            for day in days:
                if position == "first_morning":
                    turn = sorted(blocks_by_day_section.get((day, "manana"), []), key=lambda b: b["order"])
                    target_ids_by_day[day] = {b["id"] for b in turn[:run_len]}
                else:
                    turn = sorted(blocks_by_day_section.get((day, "tarde"), []), key=lambda b: b["order"])
                    target_ids_by_day[day] = {b["id"] for b in turn[-run_len:]}
            for (b, v) in var_list:
                if b["id"] not in target_ids_by_day.get(b["day"], set()):
                    forced_slot_penalties.append(v * weight)

    # ── Objective: minimize penalties ──
    # Priority order (highest to lowest weight). Classes' schedules now outrank
    # teachers' schedules throughout — teacher-preferred slots are honored only
    # after every class-schedule-quality preference is satisfied as well as it can be.
    #   1. Place all subjects fully (weight 1000)
    #   2. Consecutive block constraints (weight 100-10000)
    #   3. Forced slot exceptions (weight ~5000, editable per entry) — very strong,
    #      but still soft: breakable if nothing else fits
    #   4. Same-subject twice in one day (weight 800, editable) — a run counts as
    #      one session; anything else is heavily discouraged but still beats
    #      leaving hours unplaced
    #   5. Class-day compactness: few runs per day (weight 200), avoid thin days
    #      (weight 150), avoid lone-visit runs (weight 300)
    #   6. Heavy-subject placement: avoid back-to-back heavy (weight 80), avoid
    #      late blocks (weight 40), position gradient heavy +20/step, light -10/step
    #   7. Prefer preferred teacher slots (weight 20)
    #   8. Minimize gaps within turns (weight 3)
    #   9. Prefer early blocks (weight = order, ~0-6) — lowest priority, tiebreaker only
    all_penalties = []
    for p in under_place_penalties:
        all_penalties.append(p * 1000)
    all_penalties.extend(penalty_terms)
    # Forced slot exceptions (already pre-weighted per entry)
    all_penalties.extend(forced_slot_penalties)
    # Class-day compactness
    for p in compactness_penalties:
        all_penalties.append(p * day_compactness_weight)
    for p in thin_day_penalties:
        all_penalties.append(p * thin_day_weight)
    for p in short_run_penalties:
        all_penalties.append(p * short_visit_weight)
    # Heavy-subject placement
    for p in heavy_b2b_penalties:
        all_penalties.append(p * heavy_b2b_weight)
    for p in heavy_late_penalties:
        all_penalties.append(p * heavy_late_weight)
    # Difficulty position gradient (light bonus enters as a negative penalty)
    for p in heavy_pos_penalties:
        all_penalties.append(p * heavy_position_weight)
    for p in light_pos_penalties:
        all_penalties.append(p * -light_position_bonus)
    # Preferred slots: weight 20 per non-preferred placement
    for p in preferred_penalties:
        all_penalties.append(p * 20)
    # Spread across days
    all_penalties.extend(spread_penalties)
    # Gaps within turns: weight 3 (lower than preferred)
    for g in gap_penalties:
        all_penalties.append(g * 3)
    # Prefer early blocks
    all_penalties.extend(early_penalties)

    if all_penalties:
        model.Minimize(sum(all_penalties))

    # ── Solve ──
    # Log problem size to stderr
    num_vars = len(x)
    num_sections = len(sections)
    num_blocks = len(blocks)
    num_subjects = sum(len(s["subjects"]) for s in sections)
    print(f"[solver] Problem: {num_sections} sections, {num_subjects} subjects, {num_blocks} blocks, {num_vars} vars", file=sys.stderr)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 120.0
    solver.parameters.num_search_workers = 8

    status = solver.Solve(model)
    print(f"[solver] Status: {status} ({'OPTIMAL' if status == cp_model.OPTIMAL else 'FEASIBLE' if status == cp_model.FEASIBLE else 'INFEASIBLE' if status == cp_model.INFEASIBLE else 'UNKNOWN'})", file=sys.stderr)

    # If INFEASIBLE, try relaxing mode 2 -> mode 1 (mandatory -> try)
    if status == cp_model.INFEASIBLE:
        print("[solver] INFEASIBLE with mode 2 mandatory. Retrying with mode 2 relaxed to mode 1...", file=sys.stderr)
        # Rebuild model with relaxed constraints
        model2 = cp_model.CpModel()
        # Copy all vars and constraints but with mode 2 treated as mode 1
        # ... this is complex, so instead let's just rebuild
        # For now, return infeasible with details
        pass

    # ── Extract solution ──
    placed = []
    unplaced = []

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # Debug: log block usage per section per day
        for sec in sections:
            sid = sec["id"]
            for day in days:
                used_blocks = []
                for b in blocks:
                    if b["day"] != day:
                        continue
                    block_used = False
                    for sub in sec["subjects"]:
                        subj_id = sub["subjectId"]
                        k = (sid, subj_id, b["id"], day)
                        if k in x and solver.Value(x[k]) == 1:
                            block_used = True
                            break
                    if block_used:
                        used_blocks.append(f"{b['section']}:{b['id']}(order={b['order']})")
                if used_blocks:
                    print(f"[solver] sec{sid} {day}: {used_blocks}", file=sys.stderr)

        # Debug: log group subject placements
        group_placements = {}
        for sec in sections:
            sid = sec["id"]
            for sub in sec["subjects"]:
                if sub.get("subjectGroupId") is None:
                    continue
                subj_id = sub["subjectId"]
                for (b, v) in subject_vars.get((sid, subj_id), []):
                    if solver.Value(v) == 1:
                        key = (sec["periodGradeId"], sub["subjectGroupId"])
                        if key not in group_placements:
                            group_placements[key] = []
                        group_placements[key].append(f"sec{sid} subj{subj_id}: {b['day']} {b['id']}")
        for key, placements in group_placements.items():
            print(f"[solver] Group pg={key[0]} sg={key[1]}: {placements}", file=sys.stderr)

        for sec in sections:
            sid = sec["id"]
            pg_id = sec["periodGradeId"]
            for sub in sec["subjects"]:
                subj_id = sub["subjectId"]
                weekly = sub["weeklyBlocks"]
                teacher_id = sub.get("teacherId")
                is_group = sub.get("subjectGroupId") is not None
                is_linked = (pg_id, subj_id) in linked_pairs

                if weekly <= 0:
                    continue
                if teacher_id is None:
                    unplaced.append({"sectionId": sid, "subjectId": subj_id, "reason": "Sin profesor asignado"})
                    continue

                placed_count = 0
                for (b, v) in subject_vars.get((sid, subj_id), []):
                    if solver.Value(v) == 1:
                        placed.append({
                            "sectionId": sid,
                            "subjectId": subj_id,
                            "teacherId": teacher_id,
                            "day": b["day"],
                            "blockId": b["id"],
                            "periodIds": b["periodIds"],
                            "isGroupSubject": is_group or is_linked,
                        })
                        placed_count += 1

                if placed_count < weekly:
                    if is_group and sync_group_subjects:
                        reason = (f"Sin bloque común para el grupo ({placed_count} de {weekly}): "
                                  "la disponibilidad de los profesores no coincide")
                    elif is_linked:
                        reason = (f"Sin bloque común para el vínculo ({placed_count} de {weekly}): "
                                  "la disponibilidad de los profesores no coincide")
                    else:
                        reason = f"Sólo se colocaron {placed_count} de {weekly} bloques"
                    unplaced.append({
                        "sectionId": sid,
                        "subjectId": subj_id,
                        "reason": reason,
                    })

        result = {
            "success": len(unplaced) == 0,
            "placed": placed,
            "unplaced": unplaced,
            "stats": {
                "filledBlocks": len(placed),
                "totalBlocks": len(blocks) * len(sections),
                "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
            },
        }
    else:
        result = {
            "success": False,
            "placed": [],
            "unplaced": [
                {"sectionId": s["id"], "subjectId": sub["subjectId"], "reason": "No se encontró solución"}
                for s in sections for sub in s["subjects"] if sub["weeklyBlocks"] > 0 and sub.get("teacherId") is not None
            ],
            "stats": {
                "filledBlocks": 0,
                "totalBlocks": len(blocks) * len(sections),
                "status": "INFEASIBLE" if status == cp_model.INFEASIBLE else "UNKNOWN",
            },
        }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

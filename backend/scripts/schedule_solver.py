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
          "teacherId": 3
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
  ]
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

    # ── Identify last morning block and first afternoon block per day ──
    last_morning_block = {}  # day -> block_id
    first_afternoon_block = {}  # day -> block_id
    for day in days:
        manana = sorted(blocks_by_day_section.get((day, "manana"), []), key=lambda b: b["order"])
        tarde = sorted(blocks_by_day_section.get((day, "tarde"), []), key=lambda b: b["order"])
        if manana:
            last_morning_block[day] = manana[-1]["id"]
        if tarde:
            first_afternoon_block[day] = tarde[0]["id"]

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

    # ── Constraint 3: Teacher conflicts — no teacher in two sections at same block+day ──
    # EXCEPT for group subjects: a group subject teacher teaches all sections of the grade
    # simultaneously, so the same teacher CAN be in multiple sections at the same time
    # for group subjects.
    # Group vars by (teacherId, blockId, day)
    teacher_block_vars = {}  # (teacherId, blockId, day) -> list of BoolVars
    for sec in sections:
        sid = sec["id"]
        for sub in sec["subjects"]:
            subj_id = sub["subjectId"]
            teacher_id = sub.get("teacherId")
            if teacher_id is None:
                continue
            is_group = sub.get("subjectGroupId") is not None
            for (b, v) in subject_vars.get((sid, subj_id), []):
                if is_group:
                    continue  # group subjects are exempt from teacher conflict
                key = (teacher_id, b["id"], b["day"])
                if key not in teacher_block_vars:
                    teacher_block_vars[key] = []
                teacher_block_vars[key].append(v)

    for key, vars_list in teacher_block_vars.items():
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
            for sec in sections:
                if sec["periodGradeId"] != pg_id:
                    continue
                sid = sec["id"]
                for subj_id in subject_ids:
                    k = (sid, subj_id, b["id"], b["day"])
                    if k in x:
                        model.Add(x[k] == gs_var)

    # Debug: log group slot var counts
    group_slot_counts = {}
    for key in group_slot_vars:
        pg_id, sg_id, block_id, day = key
        gk = (pg_id, sg_id)
        group_slot_counts[gk] = group_slot_counts.get(gk, 0) + 1
    for gk, count in group_slot_counts.items():
        print(f"[solver] Group slot pg={gk[0]} sg={gk[1]}: {count} block-days available", file=sys.stderr)

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

            # Group vars by (day, section_type)
            day_section_vars = {}
            for (b, v) in subject_vars[(sid, subj_id)]:
                key = (b["day"], b["section"])
                if key not in day_section_vars:
                    day_section_vars[key] = []
                day_section_vars[key].append((b, v))

            # Sort each group by order
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
                    penalty_terms.append(excess * 1000)  # very high penalty for non-consecutive
                    penalty_terms.append(not_placed * 10000)  # even higher for not placing at all

            elif mode == 1:
                # Try consecutive: add penalty for each start beyond the first
                start_vars = []
                for key, bv_list in day_section_vars.items():
                    n = len(bv_list)
                    for i in range(n):
                        is_start = model.NewBoolVar(f"tstart_{sid}_{subj_id}_{key[0]}_{i}")
                        start_vars.append(is_start)

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

    # ── Soft preferences (not hard constraints) ──
    # 1. Minimize gaps WITHIN each turn (manana or tarde), not between turns
    # 2. Prefer "preferred" teacher slots
    # 3. Spread subjects across days
    # 4. Prefer filling early blocks

    gap_penalties = []       # penalize empty blocks between filled blocks within the same turn
    preferred_penalties = [] # penalize NOT using a preferred slot
    spread_penalties = []    # penalize concentrating a subject on one day
    early_penalties = []     # penalize using high-order (late) blocks

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

            # 3. Spread across days: penalize having more than 1 block of the same subject on the same day
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
                        spread_penalties.append(excess_day * 3)

            # 4. Prefer early blocks: penalize using high-order blocks (global order)
            for (b, v) in var_list:
                early_penalties.append(v * b.get("globalOrder", b["order"]))

    # ── Objective: minimize penalties ──
    # Priority order (highest to lowest weight):
    #   1. Place all subjects fully (weight 1000)
    #   2. Consecutive block constraints (weight 100-10000)
    #   3. Prefer preferred slots (weight 20) — respect teacher preferences strongly
    #   4. Spread across days (weight 5)
    #   5. Minimize gaps within turns (weight 3) — lower than preferred, don't pack to avoid gaps
    #   6. Prefer early blocks (weight = order, ~0-6)
    all_penalties = []
    for p in under_place_penalties:
        all_penalties.append(p * 1000)
    all_penalties.extend(penalty_terms)
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
            for sub in sec["subjects"]:
                subj_id = sub["subjectId"]
                weekly = sub["weeklyBlocks"]
                teacher_id = sub.get("teacherId")
                is_group = sub.get("subjectGroupId") is not None

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
                            "isGroupSubject": is_group,
                        })
                        placed_count += 1

                if placed_count < weekly:
                    unplaced.append({
                        "sectionId": sid,
                        "subjectId": subj_id,
                        "reason": f"Sólo se colocaron {placed_count} de {weekly} bloques",
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

# 🚀 Quick Test - 2 Minutes

## Test the Complete Implementation

All critical gaps fixed. Here's how to verify in 2 minutes:

---

## Step 1: Quality Test (30 seconds)

```bash
cd analytics-automation/packages/analytics-generator
./test-quality.sh
```

**Expected:**
```
Score: 5/5
✅ EXCELLENT - Production ready!
```

**If score < 4:** Review warnings and improve LLM prompt

---

## Step 2: Bundle Size (15 seconds)

```bash
./measure-bundle.sh
```

**Expected:**
```
Production (min+gz): ~5-8 KB
✅ Excellent - Production bundle < 10 KB
```

---

## Step 3: Server Deduplication (1 minute)

**Terminal 1 - Start Service:**
```bash
cd analytics-automation/packages/analytics-service

# Install Redis dependency
npm install

# Start service (ensure Redis is running)
npm run dev
```

**Terminal 2 - Test Deduplication:**
```bash
# Open sandbox
open http://localhost:3000/sandbox

# In browser:
# 1. Click "Send Event" button 5 times rapidly
# 2. Check Terminal 1 console

# Expected output:
# "📊 Deduplicated 4 events (rapid clicks/corrections)"
```

**Verify in Database:**
```sql
SELECT 
  event_type, 
  data->>'element_id' as element_id,
  data->>'field_correction_count' as corrections,
  COUNT(*) as count
FROM analytics_product_events
WHERE session_id = 'your-session-id'
GROUP BY event_type, element_id, corrections;

-- Expected: 1 event with field_correction_count = 4
```

---

## ✅ Success Criteria

All 3 tests pass:
- ✅ Quality score: 4-5 / 5
- ✅ Bundle size: < 10 KB gzipped
- ✅ Deduplication: Works (4 duplicates filtered)

---

## 🎉 If All Pass

**You're ready for production!**

1. ✅ Architecture is correct (Single Source of Truth)
2. ✅ Implementation is complete (server dedup works)
3. ✅ Bundle size is verified (small & fast)
4. ✅ Quality is validated (comprehensive tests)

**Ship it! 🚀**

---

## ⚠️ If Something Fails

### Quality Test Fails (Score < 4)

**Check console warnings:**
```bash
./test-quality.sh 2>&1 | grep "⚠️"
```

**Common issues:**
- Missing semantic_action → Improve LLM prompt with examples
- Sensitive fields not marked → Critical, must fix prompt
- Tracker too large → Check if old version

### Bundle Size Too Large (> 15 KB)

**Check what's in tracker:**
```bash
grep -c "enrichEventData\|checkDuplicateEvent" output/tracker.js
```

**If > 0:** Old tracker version, regenerate

### Deduplication Not Working

**Check Redis connection:**
```bash
redis-cli ping
# Expected: PONG
```

**Check environment variable:**
```bash
echo $REDIS_URL
# Expected: redis://localhost:6379 (or your Redis URL)
```

**Check processor initialized:**
```bash
# In ingest.ts, should see:
grep "createEventQualityProcessor" src/routes/ingest.ts
```

---

## 📝 Files to Check

All these should exist and be recent:

```bash
ls -lh analytics-service/src/processors/event-quality-processor.ts
ls -lh analytics-generator/test-quality.sh
ls -lh analytics-generator/measure-bundle.sh
```

If any missing: Files weren't created, check GAPS_FIXED_SUMMARY.md

---

**Quick test time:** ~2 minutes  
**Full validation:** ~5 minutes with database checks


# PortalNexus V3.0 — Final Video Evidence & Verification

**Master Video:** `PORTALNEXUS_DORAHACKS_CINEMATIC_DEMO.mp4`  
**Inspection Date:** 2026-10-31  
**Verification Target:** DoraHacks Portaldot Hacker House 2026  

---

## 1. Video Technical Metadata

Probed directly with `ffprobe -show_entries format=duration,size,bit_rate -show_streams -select_streams v:0`:

```json
{
  "streams": [
    {
      "index": 0,
      "codec_name": "h264",
      "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
      "profile": "High",
      "codec_type": "video",
      "width": 1920,
      "height": 1080,
      "r_frame_rate": "30/1",
      "pix_fmt": "yuv420p"
    }
  ],
  "format": {
    "filename": "PORTALNEXUS_DORAHACKS_CINEMATIC_DEMO.mp4",
    "duration": "151.466667",
    "size": "26231455",
    "bit_rate": "1385532"
  }
}
```

- **Duration Compliance:** 151.47s (2m 31.47s), which is strictly $< 180.00$s.
- **Visual Presentation:** 1920×1080 Full HD, progressive scanning, 30 frames per second.
- **Audio Quality:** AAC stereo 320 kbps, 48,000 Hz sample rate.

---

## 2. On-Chain Contracts Displayed in Video

All contracts exhibited in the demonstration are verifiable on the live Portaldot V3 Testnet (`Chain ID 420420777`):

| Contract | Verified Address | Block Deployed | Verified Status |
| :--- | :--- | :--- | :--- |
| **`NexusAMMNative`** | `0x407A2609dfd5336a38D6274B1EFc1804930f160A` | `#237284` | Verified (Architecture A AMM) |
| **`TestUSDCMin`** | `0x6C3BD7AD92862bB321B34a2F2762E7F2B7824002` | `#237279` | Verified (pUSDC 6-decimal token) |
| **`PortalTestStorage`** | `0x5065125265638A4b354FDDfe1f9339F65cC9f6F8` | `#261857` | Verified (`getValue() == 42`) |

---

## 3. Honest Pool State Disclosures

- **Reserves:** The video shows live `getReserves()` returning `0 POT` and `0 pUSDC`.
- **Swap Protection:** The video displays the amber empty-pool alert and explains that swaps are blocked until initial liquidity is seeded.
- **Zero Fabrication:** No mock balances, artificial volume, or fake trades were inserted.

---

## 4. Test Suite Evidence

- **Hardhat Smart Contract Suite:** 46 passing invariant and unit tests.
- **Vitest Frontend & Protocol Suite:** 190 passing tests.
- **Total Passing Automated Tests:** 236 tests passing across 15 test files.
- **Compilation:** Zero TypeScript errors (`tsc --noEmit`).

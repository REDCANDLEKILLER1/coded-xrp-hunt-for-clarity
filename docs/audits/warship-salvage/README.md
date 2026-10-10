# Warship salvage audit candidate

Base: 99b99cb4c0480cb9e55a26918ac9403ab1124018 (main after PR #133).

Applied departure reveal first, corrected swept collision second. Only adaptation: preserve current npm test chain and append both validators. Heat, seeker arming range 60, and existing proximity checks retained. Battery and debug changes excluded.

Verification: both validators exit 0; full npm test exit 0; npm run build exit 0 (tsc + Vite, 2.72s). Removing all three range clamps causes real collide() regression to fail on stationary missile at 118.27; restored implementation passes. Logs included.

Portrait and landscape PNGs use the real Space3DGame render() and approved atlas at reveal time 1.8s in a native Canvas harness. These are renderer captures with asset stubs, not browser gameplay screenshots; cockpit artwork omitted by the stub. Visual inspection confirms ship and caption fit both orientations. Browser interaction remains for independent audit.

Candidate only; no merge authorization implied. PR #122 stays open until integration is audited and merged.

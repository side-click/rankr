# Archived Thin Top Loader (`nextjs-toploader`)

`nextjs-toploader` is still installed in `package.json`. To re-enable the thin gold top bar:

1. In `app/layout.tsx`:
   ```tsx
   import NextTopLoader from "nextjs-toploader";
   // Inside <body>:
   <NextTopLoader
     color="#f0c020"
     height={3}
     showSpinner={false}
     shadow="0 0 8px #f0c020,0 0 4px #f0c020"
   />
   ```
2. In `components/AdminStatsDashboard.tsx`:
   - Swap `import { useRouter } from "next/navigation";` to `import { useRouter } from "nextjs-toploader/app";`
3. In `components/ConsensusRankingsView.tsx` (`isPending`) and `components/BetaHomeView.tsx` (`isFocusPending`):
   ```tsx
   {isPending && (
     <div className="fixed top-0 left-0 right-0 h-[3px] bg-[#f0c020] shadow-[0_0_8px_#f0c020] z-50 animate-pulse" />
   )}
   ```

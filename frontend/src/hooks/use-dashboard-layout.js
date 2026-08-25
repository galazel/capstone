import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  getBoardLayout,
  saveBoardLayout,
} from "@/services/dashboardLayoutService.js"

/**
 * Drag-to-arrange for a dashboard board, with the arrangement saved per user.
 *
 * Lifted out of the learner analytics page rather than copied into the admin and
 * institution dashboards: all three boards want identical behaviour, and the
 * fiddly parts here -- telling "not loaded yet" apart from "the defaults",
 * cancelling changes that have already been written, keeping the query cache
 * honest after a save -- are exactly the parts that rot when duplicated.
 *
 * The learner board keeps its own learner-scoped endpoint under /study-desk;
 * this one talks to /api/dashboard-layout, which is keyed on the user, because
 * admins and institution managers have no learner row.
 *
 * @param board  "admin" | "institution" — the server rejects anything else
 */
export function useDashboardLayout(board) {
  const queryClient = useQueryClient()
  const queryKey = ["dashboard-layout", board]

  const layoutQuery = useQuery({
    queryKey,
    queryFn: () => getBoardLayout(board),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const [rearranging, setRearranging] = useState(false)
  // Held locally as well as saved, so a tile lands where it was dropped or
  // dragged to size immediately rather than after the round trip.
  const [localLayout, setLocalLayout] = useState(null)

  /* Null while the saved board is still in flight -- deliberately distinct from
     `[]`, which is a real arrangement meaning "the defaults". Only `tileLayout`
     flattens the two, because rendering has to draw something either way;
     anything that could *write* the layout back has to be able to tell "no
     arrangement yet" from "the default arrangement". */
  const savedLayout = localLayout ?? layoutQuery.data?.tiles ?? null
  const tileLayout = savedLayout ?? []

  const saveLayoutMutation = useMutation({
    mutationFn: (tiles) => saveBoardLayout(board, tiles),

    /* Write the saved board straight back into the cache. Without this the
       arrangement looks like it never saved: `localLayout` only lives as long
       as the page, and on returning the board falls through to the query --
       which still holds the pre-drag value, because nothing invalidated it and
       the five-minute `staleTime` serves the cache instead of refetching.
       `setQueryData` rather than `invalidateQueries` because the PUT already
       returns the persisted board in the GET's shape. */
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved)
      setLocalLayout(null)
    },

    onError: (error) => {
      /* Drop the local override so the board falls back to the server's copy,
         which is what is actually stored. Leaving the failed arrangement on
         screen would show a layout that does not match the database, and it
         would only be discovered on some later reload. */
      setLocalLayout(null)
      console.warn("Saving the dashboard layout failed.", error)
      toast.error("Could not save your layout", {
        description:
          error?.response?.status === 404
            ? "The layout service isn't available, so arrangements cannot be saved yet."
            : "Your tiles have been put back where they were.",
      })
    },
  })

  const handleLayoutChange = (nextLayout) => {
    setLocalLayout(nextLayout)
    saveLayoutMutation.mutate(nextLayout)
  }

  const resetLayout = () => {
    setLocalLayout([])
    saveLayoutMutation.mutate([])
  }

  /* The board as it stood when this editing session opened. Cancel needs it
     because every drag saves as it happens -- by the time someone decides they
     preferred the old arrangement, the new one is already stored, so "cancel"
     has to go in the same way any other change does. */
  const [layoutBeforeEdit, setLayoutBeforeEdit] = useState(null)

  const startRearranging = () => {
    /* `savedLayout`, not `tileLayout`: entering the mode before the query has
       answered would snapshot the `[]` that stands in for "still loading", and
       cancelling would write that back as though the defaults had been asked
       for -- discarding the arrangement that actually existed. */
    setLayoutBeforeEdit(savedLayout)
    setRearranging(true)
  }

  const finishRearranging = () => {
    setLayoutBeforeEdit(null)
    setRearranging(false)
  }

  const cancelRearranging = () => {
    const previous = layoutBeforeEdit
    finishRearranging()
    // Nothing moved, so there is nothing to write. Worth the compare: otherwise
    // opening the mode and thinking better of it costs a PUT every time.
    if (previous != null && JSON.stringify(previous) !== JSON.stringify(tileLayout)) {
      setLocalLayout(previous)
      saveLayoutMutation.mutate(previous)
    }
  }

  return {
    tileLayout,
    rearranging,
    handleLayoutChange,
    resetLayout,
    startRearranging,
    finishRearranging,
    cancelRearranging,
  }
}

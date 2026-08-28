import React from "react"

import {
    Dialog,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function GenerateQuestionDialog({
                                                   onClickGenerateAiQuestions,
                                               }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button" onClick={onClickGenerateAiQuestions}>
                    Generate
                </Button>
            </DialogTrigger>

            <DialogContent
                className="h-[calc(100dvh-2rem)]
          w-[calc(100vw-2rem)]
          max-w-none
          rounded-2xl
          border-zinc-200
          bg-white
          p-0

          sm:h-[calc(100dvh-4rem)]
          sm:w-[80vw]
          sm:max-w-[80vw]

          md:w-[65vw]
          md:max-w-[65vw]

          lg:h-[min(700px,calc(100dvh-4rem))]
          lg:w-[55vw]
          lg:max-w-[55vw]

          xl:w-[55vw]
          xl:max-w-[55vw]
        "
            />
        </Dialog>
    )
}
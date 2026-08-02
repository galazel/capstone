import { useEffect, useRef, useState } from "react"
import { ImagePlus, X } from "@/components/icons"

function FileUploadComponent({
                               value,
                               onChange,
                               error,
                               imageUrl = "",
                             }) {
  const inputRef = useRef(null)


  const [previewUrl, setPreviewUrl] = useState("")
  const [localError, setLocalError] = useState("")

  useEffect(() => {

    if (!value) {
      setPreviewUrl("")
      return undefined
    }


    const objectUrl = URL.createObjectURL(value)

    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [value])

  function openFilePicker() {
    inputRef.current?.click()
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith("image/")) {
      setLocalError("Please select an image file only.")
      event.target.value = ""
      return
    }

    setLocalError("")
    onChange?.(file)
  }

  function handleRemoveImage(event) {
    event.stopPropagation()

    setLocalError("")
    onChange?.(null)

    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }








  const displayedImage = previewUrl || imageUrl

  const displayError = error || localError

  return (
      <div className="w-full">
        <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
        />

        <div
            role="button"
            tabIndex={0}
            onClick={openFilePicker}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                openFilePicker()
              }
            }}
            className="group relative flex h-60 w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 transition hover:border-[#5b6ff5] hover:bg-[#f7f8ff] focus:outline-none focus:ring-2 focus:ring-[#5b6ff5] focus:ring-offset-2"
        >
          {displayedImage ? (
              <>
                <img
                    src={displayedImage}
                    alt="Certification cover preview"
                    className="absolute inset-0 h-full w-full object-cover"
                />

                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />

                <div className="absolute right-3 bottom-3 flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
              <span className="rounded-lg bg-black/65 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                Change image
              </span>

                  <button
                      type="button"
                      onClick={handleRemoveImage}
                      title="Remove image"
                      aria-label="Remove image"
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-700 shadow-md transition hover:bg-red-50 hover:text-red-500"
                  >
                    <X size={17} />
                  </button>
                </div>
              </>
          ) : (
              <div className="flex flex-col items-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#5b6ff5] shadow-sm">
                  <ImagePlus size={22} />
                </div>

                <p className="mt-3 text-sm font-medium text-zinc-800">
                  Upload certification cover
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  PNG, JPG, WEBP, or any valid image file.
                </p>
              </div>
          )}
        </div>

        {displayError && (
            <p className="mt-2 text-sm text-red-500">
              {displayError}
            </p>
        )}
      </div>
  )
}

export default FileUploadComponent
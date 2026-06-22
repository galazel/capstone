import React from "react"
import CertificationCard from "../../components/certification-card"

function Certifications() {
  return (
    <section className="h-full bg-red-300 flex flex-col gap-3">
      <h1 className="bg-black">Active Certifications</h1>
      <div className="flex gap-5">
        <CertificationCard />
        <CertificationCard />
        <CertificationCard />
        <CertificationCard />
        <CertificationCard />
        <CertificationCard />
      </div>
    </section>
  )
}

export default Certifications

// Bid/proposal template baseline — derived from GSA guidance and FAR Part 15.
// Used by the generate-bid-draft prompt to give the agent a structured starting point.

export const BID_TEMPLATE = {
  overview: {
    description:
      "This template provides the standard structure and evaluation guidance for federal procurement bid responses. The agent should adapt sections based on the solicitation's requirement document type (SOW, PWS, or SOO) and stated evaluation criteria.",
    source: "GSA 'Respond to a Solicitation' guidance + FAR Part 15 (Contracting by Negotiation)",
  },

  requirementTypes: {
    SOW: {
      name: "Statement of Work",
      description:
        "The government knows exactly what it wants and how. Your response must demonstrate you will deliver all work on time and exactly as specified.",
      responseStrategy:
        "Mirror the SOW structure. Address each deliverable explicitly. Emphasize compliance and on-time delivery.",
    },
    PWS: {
      name: "Performance Work Statement",
      description:
        "The government defines the outcomes and metrics, but leaves the 'how' to you.",
      responseStrategy:
        "Describe your activities, methods, and processes. Show how they meet or exceed the stated performance metrics.",
    },
    SOO: {
      name: "Statement of Objectives",
      description:
        "The government states broad objectives and is open to diverse solutions.",
      responseStrategy:
        "Develop a proposed PWS, performance metrics, measurement plan, and quality assurance plan. Be creative but measurable.",
    },
  },

  proposalSections: [
    {
      section: "Cover Letter / Offer Sheet",
      purpose: "Signed offer with any exceptions to government terms",
      guidance: [
        "Include authorized representative signature",
        "Reference solicitation number, title, and due date",
        "State any exceptions or deviations from solicitation terms clearly",
        "Include representations and certifications as required",
      ],
      elicit: [],
    },
    {
      section: "Executive Summary",
      purpose:
        "High-level overview of your understanding of the requirement, your solution, and why your company is the best fit",
      guidance: [
        "Summarize the government's need in your own words to demonstrate understanding",
        "State your proposed solution concisely",
        "Highlight key differentiators (past performance, unique capabilities, pricing advantage)",
        "Keep to 1-2 pages maximum",
      ],
      elicit: [
        "What is SupplyTiger's key differentiator for this specific opportunity?",
        "Any strategic messaging the user wants to emphasize?",
      ],
    },
    {
      section: "Technical Approach",
      purpose:
        "Detailed plan demonstrating clear understanding of needs and how you will fulfill them",
      guidance: [
        "Tailor to requirement type: if SOW, show compliance step-by-step; if PWS, show how outcomes are achieved; if SOO, propose a full solution",
        "Address each evaluation subfactor explicitly if stated in the solicitation",
        "Include a work breakdown structure or phased approach where applicable",
        "Describe tools, processes, and methodologies",
        "For food/confectionery: detail climate-controlled logistics, quality assurance, shelf-life management",
      ],
      elicit: [
        "Are there specific methods or processes SupplyTiger uses for this type of work?",
        "Any specialized equipment or facilities to highlight?",
        "Does the solicitation specify SOW, PWS, or SOO?",
      ],
    },
    {
      section: "Management Approach",
      purpose: "Plan for executing, monitoring, and controlling the work",
      guidance: [
        "Define project management methodology",
        "Identify key personnel and their roles",
        "Describe communication and reporting cadence with the government",
        "Include risk identification and mitigation strategy",
        "Show organizational chart if team is involved",
      ],
      elicit: [
        "Who will be the program manager or point of contact?",
        "Any subcontractors or teaming partners involved?",
      ],
    },
    {
      section: "Past Performance",
      purpose:
        "Demonstrate successful completion of similar projects in scope and size",
      guidance: [
        "Include 2-3 relevant past performance references",
        "For each: contract number, client name, period of performance, contract value, description of work, outcomes achieved",
        "Highlight relevance to this solicitation (similar NAICS, similar agency, similar scope)",
        "Include predecessor company or key personnel experience if company history is limited",
        "Address any adverse past performance proactively if applicable",
      ],
      elicit: [
        "What are SupplyTiger's most relevant past contracts or commercial projects?",
        "Any government contracts completed? If not, relevant commercial experience?",
        "References willing to be contacted?",
      ],
    },
    {
      section: "Experience & Personnel Qualifications",
      purpose: "Relevant experience and education of team members",
      guidance: [
        "Include brief bios of key personnel",
        "Highlight certifications, clearances, or specialized training",
        "Show how team experience maps to solicitation requirements",
      ],
      elicit: [
        "Key team members and their relevant qualifications?",
        "Any industry certifications (food safety, logistics, etc.)?",
      ],
    },
    {
      section: "Quality Control Plan",
      purpose: "Metrics and processes to ensure work meets or exceeds expectations",
      guidance: [
        "Define quality control metrics and acceptable thresholds",
        "Describe inspection and acceptance procedures",
        "Include corrective action processes for non-conformances",
        "For food products: FDA compliance, temperature monitoring, lot tracking",
      ],
      elicit: [
        "What quality control processes does SupplyTiger currently use?",
        "Any third-party quality certifications?",
      ],
    },
    {
      section: "Pricing / Cost Proposal",
      purpose: "Competitive cost proposal considering quality of deliverables",
      guidance: [
        "Follow the pricing structure specified in the solicitation",
        "For firm-fixed-price: provide clear line-item pricing",
        "Ensure pricing is competitive but realistic — unrealistically low prices raise risk flags",
        "Include any volume discounts or options pricing if applicable",
        "Note: cost alone is often NOT the most important factor — balance with technical merit",
      ],
      elicit: [
        "What pricing strategy for this opportunity (competitive, value-based)?",
        "Any volume discounts or special pricing to offer?",
        "Is this a micropurchase (<$10K), simplified acquisition, or full competition?",
      ],
    },
    {
      section: "Compliance Checklist",
      purpose: "Ensure all solicitation requirements are addressed before submission",
      guidance: [
        "Verify all mandatory sections from the solicitation are addressed",
        "Check page limits, font requirements, formatting rules",
        "Confirm submission method and deadline",
        "Ensure all required attachments, certifications, and representations are included",
        "Verify SAM.gov registration is active and UEI is current",
        "Confirm NAICS code eligibility and any set-aside requirements are met",
      ],
      elicit: [],
    },
  ],

  evaluationFactors: {
    description:
      "Solicitations evaluate proposals on some or all of these factors. The solicitation will state the relative importance (e.g., 'technical is significantly more important than cost'). Tailor emphasis accordingly.",
    factors: [
      {
        name: "Cost / Price",
        weight: "Varies — often NOT the most important factor",
        tip: "Be competitive but realistic. For firm-fixed-price, price comparison establishes reasonableness.",
      },
      {
        name: "Technical Approach",
        weight: "Often the most important factor",
        tip: "Demonstrate clear understanding of needs and a concrete plan to fulfill them.",
      },
      {
        name: "Past Performance",
        weight: "Mandatory for acquisitions above simplified acquisition threshold",
        tip: "Show similar scope and size. Include predecessor company or key personnel experience.",
      },
      {
        name: "Management Approach",
        weight: "Varies by solicitation",
        tip: "Clear execution, monitoring, and control plan. Identify risks and mitigations.",
      },
      {
        name: "Experience",
        weight: "Varies by solicitation",
        tip: "Relevant experience and education of proposed team members.",
      },
      {
        name: "Quality Control",
        weight: "Varies by solicitation",
        tip: "Metrics, processes, and corrective action plans.",
      },
    ],
  },

  sourceSelectionMethods: {
    bestValue: {
      name: "Best Value / Tradeoff",
      description:
        "Award may go to other than lowest price if higher-priced proposal offers benefits that merit the additional cost. Most common for complex requirements.",
      strategy: "Emphasize technical excellence and past performance. Price matters but isn't everything.",
    },
    LPTA: {
      name: "Lowest Price Technically Acceptable",
      description:
        "Award goes to the lowest-priced proposal that meets all minimum technical requirements. Non-cost factors are pass/fail.",
      strategy: "Meet all requirements exactly. Focus on competitive pricing. Don't over-engineer the technical approach.",
    },
  },

  complianceReminders: [
    "Submit by the exact time specified — late proposals are almost never accepted",
    "Follow all formatting instructions in the solicitation (page limits, fonts, margins)",
    "Address every stated evaluation factor and subfactor",
    "Include all required certifications and representations",
    "Confirm SAM.gov registration is active before submission",
    "If set-aside applies, confirm eligibility (SBA, 8(a), WOSB, SDVOSB, HUBZone)",
  ],
};

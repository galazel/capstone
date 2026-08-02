const pexelsImage = (photoId, width = 1600) =>
  `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;

export const LANDING_IMAGES = {
  hero: pexelsImage(8199167, 2200),
  assessmentOverview: pexelsImage(7129007),
  community: pexelsImage(8457292),
  institution: pexelsImage(7693733),
  team: {
    founder: pexelsImage(31980272),
    frontend: pexelsImage(15093004),
    design: pexelsImage(7972760),
    academic: pexelsImage(20985244),
  },
  roadmap: {
    diagnostic: pexelsImage(6683580),
    plan: pexelsImage(4497732),
    lessons: pexelsImage(8199133),
    mockExam: pexelsImage(7742816),
    readiness: pexelsImage(1205651),
  },
};

// The Pillar C client components require an audience (recommendation 5): there is no default, and without one they
// render nothing. Tests of the reviewer's views render them under the reviewer audience, exactly as the reviewer page
// does. Call after the test file has registered its .tsx loader.
export async function reviewerAudience(React){
  const {PillarCAudienceProvider}=await import('../../components/dashboard-review/pillar-c/audience-context.tsx');
  const {C_REVIEWER_CLIENT_AUDIENCE}=await import('../../lib/dashboard-review/pillar-c/audience-rules.ts');
  return function underReviewerAudience(element){return React.createElement(PillarCAudienceProvider,{audience:C_REVIEWER_CLIENT_AUDIENCE},element);};
}

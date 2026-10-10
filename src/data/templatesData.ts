export interface ResponseTemplate {
  slug: string;
  h1: string;
  seoTitle: string;
  metaDescription: string;
  category: string;
  clientMessage: string;
  replyTemplate: string;
  summary: string;
}

export const RESPONSE_TEMPLATES: Record<string, ResponseTemplate> = {
  'lawn-care-whatsapp': {
    slug: 'lawn-care-whatsapp',
    h1: 'WhatsApp Reply Template for Lawn Care',
    seoTitle: 'Lawn Care WhatsApp Reply Template | Bvelt Local AI',
    metaDescription: 'Free WhatsApp response template for lawn care and mowing inquiries. Copy ready-to-send messages or create custom AI sales replies instantly.',
    category: 'Lawn Care & Mowing',
    summary: 'High-converting WhatsApp reply template for lawn mowing and yard cleanup leads.',
    clientMessage: `Hi! I need a quote for mowing my front and back lawn in Naples. It's pretty high because I was traveling. Do you have availability this week?`,
    replyTemplate: `Hi! Thanks for reaching out. We'd love to help get your lawn back in shape!

Our standard lawn care visit includes mowing, line trimming around fences and flower beds, edging walkways, and blowing off all hard surfaces.

For a typical yard, our visit ranges between $45-$65 depending on turf height and lot size. Could we stop by tomorrow afternoon around 2 PM to give you an exact quote on the spot? Let us know what time works best for you!`
  },
  'pool-cleaning-estimate': {
    slug: 'pool-cleaning-estimate',
    h1: 'Pool Cleaning Estimate Reply Template',
    seoTitle: 'Pool Cleaning Estimate Response Template | Bvelt Local AI',
    metaDescription: 'Professional estimate reply template for pool maintenance & algae cleanup inquiries. Convert pool service leads fast with Bvelt.',
    category: 'Pool Cleaning & Maintenance',
    summary: 'Professional response template for pool maintenance, chemical balancing, and green pool recovery.',
    clientMessage: `Hello, I wanted to know the price for monthly pool maintenance for a 15,000-gallon pool. The water is starting to turn slightly green and needs a deep clean right away.`,
    replyTemplate: `Hello! Thanks for contacting us. We can definitely get your pool crystal clear again!

Our monthly pool maintenance service starts at $120/mo and includes weekly chemical balancing, tile scrubbing, basket clearing, wall brushing, and filter inspection.

For initial green-water recovery, we perform a shock treatment and deep filter flush. Can we schedule a quick inspection today or tomorrow morning to test water chemistry and start the treatment?`
  },
  'house-cleaning-quote': {
    slug: 'house-cleaning-quote',
    h1: 'House Cleaning Quote Response Template',
    seoTitle: 'House Cleaning Quote Reply Template | Bvelt Local AI',
    metaDescription: 'Free professional house cleaning quote template. Reply to move-out & deep cleaning inquiries instantly with Bvelt AI.',
    category: 'House Cleaning & Janitorial',
    summary: 'Ready-to-use quote response template for residential move-out and deep house cleaning inquiries.',
    clientMessage: `Hi, I would like to get a quote for a deep cleaning of a 3-bedroom, 2-bathroom house for this Friday morning. It's for a rental handover so it needs to be spotless.`,
    replyTemplate: `Hi! Thanks for reaching out. Congratulations on the move!

Our Move-Out Deep Cleaning package covers detailed kitchen & appliance degreasing, bathroom sanitization, baseboards, inside cabinets, and complete floor care to guarantee deposit returns.

For a 3-bedroom / 2-bathroom layout, our deep clean is typically $220-$280 depending on current condition. We currently have an opening this Friday at 8:30 AM. Would you like us to reserve that spot for you?`
  },
  'handyman-reply': {
    slug: 'handyman-reply',
    h1: 'Handyman Service Reply Template',
    seoTitle: 'Handyman Response Template for Customer Leads | Bvelt Local AI',
    metaDescription: 'Professional handyman message template to answer customer job requests, drywall repairs, and fixture installations quickly.',
    category: 'Handyman & Home Repairs',
    summary: 'Fast customer response template for handyman home repairs, drywall fixes, and fixture installations.',
    clientMessage: `Hi, I have a few small jobs around the house: hanging two ceiling fans, fixing a drywall patch in the hallway, and replacing a bathroom faucet. How much do you charge per hour or per project?`,
    replyTemplate: `Hi! Thanks for reaching out. We handle fan installations, drywall patching, and plumbing fixture swaps every week!

Rather than hourly surprises, we provide flat-rate project estimates so you know the exact cost upfront. Based on your list, a bundled half-day service usually runs $180-$250 including standard hardware and patch materials.

Are you available Thursday morning for us to take a quick look or get started?`
  },
  'landscaping-follow-up': {
    slug: 'landscaping-follow-up',
    h1: 'Landscaping Follow-Up Message Template',
    seoTitle: 'Landscaping Quote Follow-Up Template | Bvelt Local AI',
    metaDescription: 'High-converting follow-up template for landscaping, paver, and garden design estimates. Close open landscaping quotes fast with Bvelt.',
    category: 'Landscaping & Hardscaping',
    summary: 'High-conversion follow-up template for open landscaping, paver, and mulch installation proposals.',
    clientMessage: `Thanks for sending over the landscaping proposal last week for the patio pavers and mulch installation. We're reviewing a couple of options.`,
    replyTemplate: `Hi! Just checking in to see if you had any questions regarding the paver and mulch design proposal we sent over.

We currently have crew availability opening up next Monday, and we'd love to get your project scheduled before our spring calendar fills up! If you'd like to adjust any materials or plant selections to fit your budget, I'm happy to make quick tweaks.

Do you have 5 minutes for a quick call today?`
  }
};

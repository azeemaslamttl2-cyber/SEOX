import socialLinks from "./socialLinks.js";
import profileLinks from "./profileLinks.js";
import companyBacklinks from "./companyBacklinks.js";
import toolWebsites from "./toolWebsites.js";
import trustReviews from "./trustReviews.js";
import commentBacklinks from "./commentBacklinks.js";
import eduBacklinks from "./eduBacklinks.js";
import govBacklinks from "./govBacklinks.js";
import forumBacklinks from "./forumBacklinks.js";
import socialBookmarking from "./socialBookmarking.js";
import guestPosting from "./guestPosting.js";
import directoryBacklinks from "./directoryBacklinks.js";
import dealSites from "./dealSites.js";
import jobBoards from "./jobBoards.js";
import pressRelease from "./pressRelease.js";
import urlShortener from "./urlShortener.js";
import localCitation from "./localCitation.js";
import localCitationUS from "./localCitationUS.js";
import web2 from "./web2.js";
import fileUpload from "./fileUpload.js";
import productLaunch from "./productLaunch.js";
import infographics from "./infographics.js";
import classifiedAds from "./classifiedAds.js";
import communities from "./communities.js";
import couponSites from "./couponSites.js";
import crowdfunding from "./crowdfunding.js";

export const allBacklinkCategories = [
  socialLinks,
  profileLinks,
  companyBacklinks,
  toolWebsites,
  trustReviews,
  commentBacklinks,
  eduBacklinks,
  govBacklinks,
  forumBacklinks,
  socialBookmarking,
  guestPosting,
  directoryBacklinks,
  dealSites,
  jobBoards,
  pressRelease,
  urlShortener,
  localCitation,
  localCitationUS,
  web2,
  fileUpload,
  productLaunch,
  infographics,
  classifiedAds,
  communities,
  couponSites,
  crowdfunding,
];

export const totalOpportunities = allBacklinkCategories.reduce((sum, c) => sum + c.totalLinks, 0);
export const totalCategories = allBacklinkCategories.length;

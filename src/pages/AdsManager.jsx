import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Target,
  Calendar,
  DollarSign,
  Play,
  Pause,
  Edit2,
  Trash2,
  ExternalLink,
  CheckCircle2,
  MousePointerClick
} from 'lucide-react';

export default function AdsManager() {
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    platform: 'facebook',
    budget: '',
    currency: 'NGN',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    target_audience: {
      age_range: '',
      location: '',
      interests: ''
    },
    ad_copy: '',
    notes: '',
    status: 'draft'
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadCampaigns();
    }
  }, [user]);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return;
    }
    setUser(user);
  }

  async function loadCampaigns() {
    try {
      const { data, error } = await supabase
        .from('ad_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const campaignData = {
        title: formData.title,
        description: formData.description || null,
        platform: formData.platform,
        budget: parseFloat(formData.budget) || 0,
        currency: formData.currency,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        target_audience: formData.target_audience,
        ad_copy: formData.ad_copy || null,
        tracking_link: generateTrackingLink(formData.title, formData.platform),
        status: formData.status,
        notes: formData.notes || null
      };

      if (editingCampaign) {
        const { error } = await supabase
          .from('ad_campaigns')
          .update(campaignData)
          .eq('id', editingCampaign.id);

        if (error) throw error;
        alert('Campaign updated successfully!');
      } else {
        const { error } = await supabase
          .from('ad_campaigns')
          .insert([{
            ...campaignData,
            user_id: user.id
          }]);

        if (error) throw error;
        alert('Campaign created successfully!');
      }

      setShowCreateModal(false);
      setEditingCampaign(null);
      resetForm();
      loadCampaigns();
    } catch (error) {
      console.error('Error saving campaign:', error);
      alert('Error saving campaign. Please try again.');
    }
  }

  function generateTrackingLink(title, platform) {
    const baseUrl = window.location.origin;
    const campaignName = title.toLowerCase().replace(/\s+/g, '-');
    return `${baseUrl}?utm_source=${platform}&utm_medium=cpc&utm_campaign=${campaignName}`;
  }

  function resetForm() {
    setFormData({
      title: '',
      description: '',
      platform: 'facebook',
      budget: '',
      currency: 'NGN',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      target_audience: {
        age_range: '',
        location: '',
        interests: ''
      },
      ad_copy: '',
      notes: '',
      status: 'draft'
    });
  }

  async function handleStatusChange(campaignId, newStatus) {
    try {
      const { error } = await supabase
        .from('ad_campaigns')
        .update({ status: newStatus })
        .eq('id', campaignId);

      if (error) throw error;
      loadCampaigns();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating campaign status');
    }
  }

  async function handleDelete(campaignId) {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    try {
      const { error } = await supabase
        .from('ad_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
      loadCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Error deleting campaign');
    }
  }

  function handleEdit(campaign) {
    setEditingCampaign(campaign);
    setFormData({
      title: campaign.title || '',
      description: campaign.description || '',
      platform: campaign.platform,
      budget: campaign.budget?.toString() || '',
      currency: campaign.currency || 'NGN',
      start_date: campaign.start_date || new Date().toISOString().split('T')[0],
      end_date: campaign.end_date || '',
      target_audience: campaign.target_audience || { age_range: '', location: '', interests: '' },
      ad_copy: campaign.ad_copy || '',
      notes: campaign.notes || '',
      status: campaign.status
    });
    setShowCreateModal(true);
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    if (activeTab === 'all') return true;
    return campaign.status === activeTab;
  });

  const platformGuides = {
    facebook: {
      name: 'Facebook Ads',
      color: 'blue',
      steps: [
        'Go to Facebook Ads Manager (business.facebook.com/adsmanager)',
        'Click "Create" to start a new campaign',
        'Choose your campaign objective (Awareness, Traffic, Engagement, etc.)',
        'Name your campaign and set up A/B testing if needed',
        'Set your daily or lifetime budget',
        'Define your target audience (location, age, interests, behaviors)',
        'Choose placements (Automatic or Manual)',
        'Create your ad with images/video and compelling copy',
        'Add your tracking link in the "Website URL" field',
        'Review and publish your campaign'
      ],
      link: 'https://www.facebook.com/business/ads'
    },
    instagram: {
      name: 'Instagram Ads',
      color: 'pink',
      steps: [
        'Go to Meta Ads Manager (business.facebook.com/adsmanager)',
        'Click "Create" and select your campaign objective',
        'Under placements, select "Manual placements"',
        'Check Instagram Feed, Stories, Reels, or Explore',
        'Set your budget and schedule',
        'Define your target audience demographics',
        'Upload eye-catching vertical content (9:16 for Stories/Reels)',
        'Write engaging captions with relevant hashtags',
        'Add your tracking link to the CTA button',
        'For Stories, use the "Swipe Up" or link sticker feature',
        'Review and launch your campaign'
      ],
      link: 'https://business.instagram.com/advertising'
    },
    google: {
      name: 'Google Ads',
      color: 'green',
      steps: [
        'Go to Google Ads (ads.google.com)',
        'Click "New Campaign" in the left menu',
        'Select your campaign goal (Sales, Leads, Traffic, etc.)',
        'Choose campaign type (Search, Display, Video, Shopping, etc.)',
        'Set your geographic targeting and languages',
        'Configure bidding strategy (Manual CPC, Maximize clicks, etc.)',
        'Set your daily budget',
        'For Search: Add keywords and create responsive search ads',
        'For Display: Upload images and create responsive display ads',
        'Set your final URL to your tracking link',
        'Add ad extensions (sitelinks, callouts, structured snippets)',
        'Review and launch your campaign'
      ],
      link: 'https://ads.google.com'
    },
    tiktok: {
      name: 'TikTok Ads',
      color: 'slate',
      steps: [
        'Go to TikTok Ads Manager (ads.tiktok.com)',
        'Create a Business Account if you haven\'t already',
        'Click "Create" to start a new campaign',
        'Choose your advertising objective (Traffic, Conversions, App Install)',
        'Set your campaign budget (Daily or Lifetime)',
        'Create an Ad Group and define your target audience',
        'Select automatic or custom placements',
        'Set your bid and optimization goal',
        'Create engaging vertical video content (9:16 ratio)',
        'Use trending sounds and authentic-feeling content',
        'Add your tracking link in the Destination URL',
        'Include a strong call-to-action',
        'Review and submit for approval'
      ],
      link: 'https://ads.tiktok.com'
    },
    twitter: {
      name: 'Twitter/X Ads',
      color: 'sky',
      steps: [
        'Go to Twitter Ads (ads.twitter.com)',
        'Click "Create campaign" in the top right',
        'Choose your objective (Reach, Engagement, Traffic, etc.)',
        'Name your campaign and set budget',
        'Define your target audience by demographics and interests',
        'Use keyword targeting to reach relevant conversations',
        'Select placements (Timeline, Profiles, Search results)',
        'Create your ad with compelling copy (max 280 characters)',
        'Add images (1200x675px) or video (max 2:20)',
        'Include your tracking link in the tweet or card',
        'Set up conversion tracking with Twitter Pixel',
        'Review and launch your campaign'
      ],
      link: 'https://ads.twitter.com'
    },
    linkedin: {
      name: 'LinkedIn Ads',
      color: 'blue',
      steps: [
        'Go to LinkedIn Campaign Manager (linkedin.com/campaignmanager)',
        'Click "Create campaign"',
        'Choose your objective (Brand awareness, Website visits, Lead gen)',
        'Select your target audience using professional criteria',
        'Target by job title, company, industry, skills, groups',
        'Use Matched Audiences for retargeting',
        'Choose your ad format (Single image, Carousel, Video, etc.)',
        'Set your budget and bidding strategy',
        'Create professional ad content with clear value proposition',
        'For Lead Gen Forms, customize your form fields',
        'Add your tracking link as the destination URL',
        'Install LinkedIn Insight Tag for conversion tracking',
        'Review and launch your campaign'
      ],
      link: 'https://www.linkedin.com/campaignmanager'
    },
    youtube: {
      name: 'YouTube Ads',
      color: 'red',
      steps: [
        'Go to Google Ads (ads.google.com)',
        'Click "New Campaign" and select Video',
        'Choose your campaign subtype (Skippable, Non-skippable, Bumper)',
        'Set your campaign name and budget',
        'Select networks (YouTube videos, YouTube search, Video partners)',
        'Define your target audience and demographics',
        'Choose content exclusions and inventory type',
        'Set your bidding strategy (CPV, CPM, or Target CPA)',
        'Upload your video to YouTube first',
        'Create your video ad with the YouTube video URL',
        'Add your final URL (tracking link) and display URL',
        'Create companion banners if applicable',
        'Review and launch your campaign'
      ],
      link: 'https://ads.google.com'
    },
    snapchat: {
      name: 'Snapchat Ads',
      color: 'yellow',
      steps: [
        'Go to Snapchat Ads Manager (ads.snapchat.com)',
        'Create a business account if needed',
        'Click "Create Ads" to start',
        'Choose your objective (Awareness, Consideration, Conversion)',
        'Set your campaign name and status',
        'Define your target audience by age, gender, location',
        'Use Snap Audience Match for custom audiences',
        'Select ad placements (Stories, Discover, etc.)',
        'Set your daily or lifetime budget',
        'Choose your bid strategy',
        'Create vertical video content (9:16, 3-10 seconds ideal)',
        'Add your tracking link as the swipe-up destination',
        'Include attention-grabbing visuals and sound',
        'Review and publish your campaign'
      ],
      link: 'https://ads.snapchat.com'
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This is a campaign planning tool. Your ads are not automatically published.
            After creating a campaign here, go to the ad platform (Meta, Google, etc.) to create and launch your actual ad,
            using the tracking link as your destination URL.
          </p>
        </div>

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Ads Manager</h1>
            <p className="text-slate-600 mt-1">Plan and organize your advertising campaigns</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setEditingCampaign(null);
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
            New Campaign
          </button>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'draft', 'active', 'paused', 'completed'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab !== 'all' && (
                <span className="ml-2 text-xs">
                  ({campaigns.filter(c => c.status === tab).length})
                </span>
              )}
              {tab === 'all' && (
                <span className="ml-2 text-xs">({campaigns.length})</span>
              )}
            </button>
          ))}
        </div>

        {filteredCampaigns.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              {activeTab === 'all' ? 'No campaigns yet' : `No ${activeTab} campaigns`}
            </h3>
            <p className="text-slate-600 mb-6">
              Create your first advertising campaign to get started
            </p>
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PlusCircle className="w-5 h-5" />
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredCampaigns.map(campaign => (
              <div key={campaign.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-slate-900">{campaign.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        campaign.status === 'active' ? 'bg-green-100 text-green-700' :
                        campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                        campaign.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-slate-600 mb-3">{campaign.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {campaign.platform.charAt(0).toUpperCase() + campaign.platform.slice(1)}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {campaign.currency === 'NGN' ? '₦' : '$'}{campaign.budget?.toLocaleString() || 0}
                      </span>
                      {campaign.clicks > 0 && (
                        <span className="flex items-center gap-1">
                          <MousePointerClick className="w-4 h-4" />
                          {campaign.clicks} clicks
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {campaign.start_date ? new Date(campaign.start_date).toLocaleDateString() : 'No date'}
                        {campaign.end_date && ` - ${new Date(campaign.end_date).toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {campaign.status === 'draft' && (
                      <button
                        onClick={() => handleStatusChange(campaign.id, 'active')}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Activate campaign"
                      >
                        <Play className="w-5 h-5" />
                      </button>
                    )}
                    {campaign.status === 'active' && (
                      <button
                        onClick={() => handleStatusChange(campaign.id, 'paused')}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                        title="Pause campaign"
                      >
                        <Pause className="w-5 h-5" />
                      </button>
                    )}
                    {campaign.status === 'paused' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(campaign.id, 'active')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Resume campaign"
                        >
                          <Play className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(campaign.id, 'completed')}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Mark as completed"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleEdit(campaign)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit campaign"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(campaign.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete campaign"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {campaign.tracking_link && (
                  <div className="bg-slate-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-700 mb-1">Tracking Link:</p>
                        <p className="text-sm text-slate-600 font-mono break-all">{campaign.tracking_link}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(campaign.tracking_link);
                          alert('Tracking link copied!');
                        }}
                        className="ml-4 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                      <p className="text-xs font-medium text-amber-800 mb-1">How to use this link:</p>
                      <p className="text-xs text-amber-700">
                        Copy this link and paste it as the <strong>destination URL</strong> when creating your ad on {campaign.platform.charAt(0).toUpperCase() + campaign.platform.slice(1)}.
                        This link helps you track which visitors came from this specific campaign in your analytics.
                      </p>
                    </div>
                  </div>
                )}

                {campaign.ad_copy && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
                    <p className="text-xs font-medium text-blue-700 mb-1">Ad Copy:</p>
                    <p className="text-sm text-blue-800">{campaign.ad_copy}</p>
                  </div>
                )}

                {campaign.notes && (
                  <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
                    <p className="text-sm text-amber-800">{campaign.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingCampaign ? 'Edit Campaign' : 'Create New Campaign'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCampaign(null);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Campaign Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Summer Sale Campaign"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="2"
                    placeholder="Brief description of your campaign..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Platform *
                  </label>
                  <select
                    required
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="google">Google Ads</option>
                    <option value="tiktok">TikTok</option>
                    <option value="twitter">Twitter/X</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="youtube">YouTube</option>
                    <option value="snapchat">Snapchat</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Budget *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="NGN">₦ NGN</option>
                      <option value="USD">$ USD</option>
                    </select>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="10000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Target Audience</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Age Range
                    </label>
                    <input
                      type="text"
                      value={formData.target_audience.age_range}
                      onChange={(e) => setFormData({
                        ...formData,
                        target_audience: { ...formData.target_audience, age_range: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="18-35"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.target_audience.location}
                      onChange={(e) => setFormData({
                        ...formData,
                        target_audience: { ...formData.target_audience, location: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Lagos, Nigeria"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Interests
                    </label>
                    <input
                      type="text"
                      value={formData.target_audience.interests}
                      onChange={(e) => setFormData({
                        ...formData,
                        target_audience: { ...formData.target_audience, interests: e.target.value }
                      })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Fashion, Technology"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ad Copy / Creative Text
                </label>
                <textarea
                  value={formData.ad_copy}
                  onChange={(e) => setFormData({ ...formData, ad_copy: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="4"
                  placeholder="Write your ad copy here... Include headline, description, and call-to-action"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Campaign Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows="2"
                  placeholder="Add any important notes or learnings..."
                />
              </div>

              {formData.platform && platformGuides[formData.platform] && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <ExternalLink className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 mb-3">
                        How to launch on {platformGuides[formData.platform].name}
                      </h4>
                      <ol className="space-y-2 text-sm text-blue-800">
                        {platformGuides[formData.platform].steps.map((step, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="font-semibold text-blue-600 flex-shrink-0">{index + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                      <a
                        href={platformGuides[formData.platform].link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium mt-4 bg-blue-100 px-3 py-2 rounded-lg"
                      >
                        Open {platformGuides[formData.platform].name}
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {editingCampaign ? 'Update Campaign' : 'Create Campaign'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingCampaign(null);
                    resetForm();
                  }}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '@/utils/auth';
import { Button } from '@/components/ui/button';
import { Users, Shirt, MessageSquare, ArrowRight, Sparkles } from 'lucide-react';
import LogoText from '@/components/LogoText';

const Index = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          <div className="flex justify-center mb-8">
            <LogoText width={290} height={34} className="text-black" />
          </div>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-700">
            Professional wardrobe management for independent stylists
          </p>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Consolidate your styling workflow into one platform. Import clients, manage closets, create looks, and collaborate seamlessly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => navigate('/signup')} className="w-full sm:w-auto">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="w-full sm:w-auto">
              Log In
            </Button>
          </div>
          <p className="text-sm text-gray-500">
            No credit card required • 2-minute setup
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
          <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Client Management</h3>
            <p className="text-gray-600 text-sm">
              Import existing clients via CSV and manage relationships in one place
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-pink-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Shirt className="h-6 w-6 text-pink-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Digital Closets</h3>
            <p className="text-gray-600 text-sm">
              Bulk upload closet photos with AI categorization for fast migration
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Look Creation</h3>
            <p className="text-gray-600 text-sm">
              Create and edit looks on any device with client approval workflow
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Direct Messaging</h3>
            <p className="text-gray-600 text-sm">
              Communicate with clients and share looks directly in the platform
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-12 sm:mt-20 max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">How It Works</h2>
          <div className="space-y-8">
            <div className="flex gap-4 sm:gap-6 items-start">
              <div className="bg-purple-600 text-white rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center font-bold flex-shrink-0 text-sm sm:text-base">
                1
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">Sign Up & Set Up Profile</h3>
                <p className="text-gray-600 text-sm sm:text-base">
                  Create your account with Google, Apple, or email in under 2 minutes. Add your photo, bio, and location.
                </p>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-6 items-start">
              <div className="bg-purple-600 text-white rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center font-bold flex-shrink-0 text-sm sm:text-base">
                2
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">Import Your Clients</h3>
                <p className="text-gray-600 text-sm sm:text-base">
                  Upload a CSV file to import all your existing clients at once, or add them manually one by one.
                </p>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-6 items-start">
              <div className="bg-purple-600 text-white rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center font-bold flex-shrink-0 text-sm sm:text-base">
                3
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">Build Digital Closets</h3>
                <p className="text-gray-600 text-sm sm:text-base">
                  Bulk upload closet photos (up to 200 at once) or add items individually. Organize by category, brand, and color.
                </p>
              </div>
            </div>

            <div className="flex gap-4 sm:gap-6 items-start">
              <div className="bg-purple-600 text-white rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center font-bold flex-shrink-0 text-sm sm:text-base">
                4
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2">Create & Share Looks</h3>
                <p className="text-gray-600 text-sm sm:text-base">
                  Build looks from closet items, add styling notes, and send to clients for approval - all from your phone or desktop.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Migration Focus */}
        <div className="mt-12 sm:mt-20 bg-white rounded-2xl p-6 sm:p-8 md:p-12 shadow-lg">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold">Built for Migration</h2>
            <p className="text-base sm:text-lg text-gray-600">
              Already managing clients with Stylebook, Google Drive, and scattered tools? 
              Turnstyle makes it easy to consolidate everything in under 10 minutes.
            </p>
            <ul className="text-left space-y-3 max-w-xl mx-auto pt-4">
              <li className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full p-1 mt-1">
                  <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">Import all clients at once via CSV</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full p-1 mt-1">
                  <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">Bulk upload closet photos (up to 200 at once)</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full p-1 mt-1">
                  <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">Client-owned closets that survive relationship changes</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="bg-purple-100 rounded-full p-1 mt-1">
                  <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">Works seamlessly on mobile and desktop</span>
              </li>
            </ul>
            <div className="pt-6">
              <Button size="lg" onClick={() => navigate('/signup')}>
                Start Your Migration
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* CTA Footer */}
        <div className="mt-12 sm:mt-20 text-center px-4">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Ready to streamline your styling business?</h2>
          <p className="text-gray-600 mb-6">Join stylists who are already using Turnstyle</p>
          <Button size="lg" onClick={() => navigate('/signup')} className="w-full sm:w-auto">
            Get Started Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
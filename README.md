# Loan Data Curator

A swipe-based loan data point curation tool built with Next.js, React, TypeScript, and Supabaseee. 

## Features

- **Intuitive Swipe Interface**: Swipe to categorize loan data points
  - Swipe Right → Keep
  - Swipe Left → Delete
  - Swipe Up → Favorite
  - Swipe Down → Add Notes

- **Powerful Navigation**:
  - Keyboard shortcuts (K=Keep, D=Delete, F=Favorite, N=Notes, U=Undo)
  - Category filtering
  - Progress tracking
  - Undo functionality

- **Real-time Analytics**: Track your curation progress with live statistics

## Quick Start

1. Clone this repository
2. Install dependencies: `npm install`
3. Set up environment variables (see below)
4. Run development server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

## Database Schema

The app expects a Supabase table named `DataPts` with the following columns:

- `Key` (text, primary key)
- `Category` (text)
- `Data Point` (text)
- `status` (text) - Added by the app for tracking decisions
- `notes` (text) - Added by the app for user notes
- `reviewed_at` (timestamp) - Added by the app for tracking review time
- `priority_score` (integer) - Added by the app for future enhancements

## Deployment

This app is optimized for deployment on Vercel:

1. Push to GitHub
2. Import your repository in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy!

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **Icons**: Lucide React
- **Deployment**: Vercel

## Usage

1. **Start Reviewing**: The app loads your loan data points automatically
2. **Make Decisions**: Use swipe gestures or buttons to categorize each data point
3. **Track Progress**: Monitor your progress with the built-in analytics
4. **Filter by Category**: Focus on specific categories like "1003", "Underwriting", etc.
5. **Export Results**: Query your Supabase database to get curated lists

## Keyboard Shortcuts

- `K` - Keep the current data point
- `D` - Delete the current data point
- `F` - Mark as favorite
- `N` - Add notes
- `U` - Undo last action
- `←` - Previous data point
- `→` - Next data point

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use this project for your own loan data curation needs!

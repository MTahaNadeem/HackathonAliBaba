import CourseCompassApp from '@/components/coursecompass-app';
import { ErrorBoundary } from '@/components/error-boundary';

export default function Page() {
  return (
    <ErrorBoundary>
      <CourseCompassApp />
    </ErrorBoundary>
  );
}

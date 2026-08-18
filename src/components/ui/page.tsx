import { ReactNode, useEffect } from "react";

import { cn } from "@/lib/utils";

interface PageTitleProps {
  title: string;
  className?: string;
  componentRight?: ReactNode;
  isInsidePage?: boolean;
  changePageMetadata?: boolean;
  hideTitleOnPage?: boolean;
}

function PageHeadTitle({ title }: { title: string }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title ? `${title} | Care` : "Care";
    return () => {
      document.title = prevTitle;
    };
  }, [title]);

  return null;
}

function PageTitle({
  title,
  className = "",
  componentRight = null,
  isInsidePage = false,
  changePageMetadata = true,
  hideTitleOnPage,
}: PageTitleProps) {
  return (
    <div className={cn(!isInsidePage && "mb-2 md:mb-4", className)}>
      {changePageMetadata && <PageHeadTitle title={title} />}

      <div
        className={cn(
          "mt-1 flex",
          componentRight &&
            "flex-col justify-start space-y-2 md:flex-row md:justify-between md:space-y-0",
        )}
      >
        <div className="flex items-center">
          {!hideTitleOnPage && (
            <h2 className="ml-0 text-2xl leading-tight">{title}</h2>
          )}
        </div>
        {componentRight}
      </div>
    </div>
  );
}

interface PageProps extends PageTitleProps {
  children: ReactNode;
  options?: ReactNode;
  style?: React.CSSProperties;
}

export default function Page(props: PageProps) {
  return (
    <div className={cn("md:px-6 py-0", props.className)} style={props.style}>
      <div className="flex flex-col justify-between gap-2 px-3 md:flex-row md:items-center md:gap-6 md:px-0">
        <PageTitle
          changePageMetadata={props.changePageMetadata}
          title={props.title}
          componentRight={props.componentRight}
          isInsidePage={true}
          hideTitleOnPage={props.hideTitleOnPage}
        />
        {props.options}
      </div>
      {props.children}
    </div>
  );
}

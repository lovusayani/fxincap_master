import Image from "next/image";

const LearnAppSection = () => {
  return (
    <section className="flex flex-col bg-[#d4ff00] px-6 py-20 text-black">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center">
        <h1 className="mb-6 max-w-[600px] text-center font-headline text-4xl font-normal leading-[1.1] text-black md:text-[56px]">
          Become a better investor on the go, right in the app
        </h1>

        <p className="mb-10 max-w-[480px] text-center text-lg font-normal leading-[1.4] text-black">
          Here's a preview of the things you can learn when you sign up.
        </p>

        <a
          href="#"
          className="mb-14 inline-flex items-center justify-center rounded-full bg-black px-6 py-[14px] text-sm font-medium text-white transition-transform duration-200 ease-in-out hover:scale-[1.04]"
        >
          Sign up to access  Suimfx Learn
        </a>

        <div className="mb-8 w-full max-w-[474px]">
          <Image
            src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7605a280-297f-425c-8895-09bacf5b13a3-robinhood-com/assets/images/homepage_learn_phone_2x-5.png"
            alt="A phone displaying the  Suimfx Learn interface."
            width={474}
            height={612}
            className="mx-auto block"
          />
        </div>
      </div>
    </section>
  );
};

export default LearnAppSection;
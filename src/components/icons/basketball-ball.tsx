import { bsIconPropsToDataStore } from './icons'
import type { BsIconProps } from './icons.d'

export default function BsIconBasketballBall(props: BsIconProps) {
  const data = bsIconPropsToDataStore(props)

  return (
    <svg
      role="img"
      aria-label="Basketball ball"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      viewBox="0 0 77.832 77.832"
      width={data.width}
      height={data.height}
      fill={data.fill}
    >
      <g>
        <path
          d="M38.916,0C17.458,0,0,17.458,0,38.916c0,2.489,0.245,4.923,0.693,7.284l-0.146,0.175c0.07,0.059,0.138,0.109,0.208,0.167
		c3.555,17.819,19.312,31.29,38.161,31.29c21.458,0,38.916-17.458,38.916-38.916S60.374,0,38.916,0z M72.061,25.249
		c-0.052,12.625-11.312,15.317-16.045,15.888c3.945-13.604,2.821-26.663,1.959-32.572C64.236,12.512,69.199,18.337,72.061,25.249z
		 M54.559,6.658c0.653,3.375,3.119,18.577-1.675,34.318c-9.122-2.418-10.416-9.061-12.143-18.104
		c-1.169-6.126-2.491-12.99-6.694-19.474c1.594-0.217,3.217-0.339,4.869-0.339C44.521,3.059,49.829,4.354,54.559,6.658z
		 M30.764,4.005c4.453,6.291,5.793,13.262,6.973,19.441c1.714,8.979,3.346,17.479,14.175,20.446
		c-0.799,2.201-1.749,4.398-2.877,6.562c-22.46-10.88-36.241-28.358-39.237-32.423C14.786,11.094,22.187,6.007,30.764,4.005z
		 M8.018,20.751c4.195,5.486,17.939,21.856,39.521,32.371c-0.844,1.407-1.773,2.791-2.789,4.147
		c-5.908-2.934-11.457-3.388-16.834-3.826c-7.44-0.607-15.128-1.256-24.354-8.571c-0.326-1.938-0.504-3.926-0.504-5.956
		C3.059,32.29,4.872,26.083,8.018,20.751z M4.647,49.475c8.612,5.83,15.922,6.438,23.021,7.018c5.113,0.417,9.972,0.82,15.12,3.232
		c-4.148,4.854-9.563,9.235-16.591,12.709C15.932,68.525,7.908,60.038,4.647,49.475z M30.319,73.725
		c6.382-3.564,11.38-7.873,15.283-12.574c1.639,0.906,4.851,3.021,5.688,6.066c0.497,1.805,0.046,3.756-1.312,5.803
		c-3.485,1.133-7.201,1.754-11.061,1.754C35.953,74.773,33.074,74.405,30.319,73.725z M54.134,71.374
		c0.507-1.685,0.552-3.351,0.101-4.983c-1.068-3.863-4.598-6.434-6.729-7.677c1.028-1.403,1.967-2.833,2.823-4.284
		c5.354,2.402,11.157,4.416,17.387,5.82C64.193,64.993,59.529,68.834,54.134,71.374z M69.557,57.523
		c-6.373-1.342-12.293-3.354-17.74-5.776c1.27-2.456,2.322-4.952,3.191-7.446c2.686-0.195,10.21-1.199,15.299-6.387
		c1.709-1.742,2.957-3.786,3.758-6.096c0.463,2.295,0.709,4.668,0.709,7.098C74.773,45.725,72.865,52.096,69.557,57.523z"
        />
      </g>
    </svg>
  )
}
